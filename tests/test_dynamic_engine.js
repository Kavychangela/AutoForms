// Unit test suite for AutoForms Dynamic Form Engine
const assert = require('assert');

// ─── Implementation extracted from content.js for testing ─────────────────

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matches(text, ...kws) {
    if (!text || typeof text !== "string") return false;
    const normalizedText = text.toLowerCase();
    
    return kws.some(kw => {
        if (!kw) return false;
        const normKw = kw.toLowerCase().trim();
        const pattern = normKw.split(/[\s\-_]+/).map(escapeRegex).join("[\\s\\-_]+");
        const regex = new RegExp(`(?:^|[^a-z0-9])${pattern}(?:$|[^a-z0-9])`, "i");
        return regex.test(normalizedText);
    });
}

const SECTION_TAXONOMY = {
    experience: {
        keywords: ["experience", "work history", "employment", "job history", "positions", "work experience", "career"],
        resumeKeys: ["experience"]
    },
    education: {
        keywords: ["education", "academic", "qualification", "degree", "schooling", "college", "university"],
        resumeKeys: ["education"]
    },
    projects: {
        keywords: ["project", "projects", "portfolio", "side projects"],
        resumeKeys: ["projects"]
    },
    certifications: {
        keywords: ["certification", "certifications", "certificate", "license", "licenses", "credentials"],
        resumeKeys: ["certifications", "licenses"]
    },
    skills: {
        keywords: ["skill", "skills", "technologies", "competencies"],
        resumeKeys: ["skills"]
    },
    languages: {
        keywords: ["language", "languages"],
        resumeKeys: ["languages"]
    }
};

function getResumeEntriesForSection(sectionType, data) {
    if (!data || !sectionType) return [];
    const tax = SECTION_TAXONOMY[sectionType];
    if (tax && tax.resumeKeys) {
        for (const key of tax.resumeKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                return data[key];
            }
        }
    }
    if (sectionType === "experience" && (data.current_company || data.current_role)) {
        return [{ company: data.current_company || "", role: data.current_role || "" }];
    }
    if (sectionType === "education" && (data.college || data.degree)) {
        return [{ institution: data.college || "", degree: data.degree || "" }];
    }
    return [];
}

function classifyControlText(text, containerText = "") {
    const normalizedText = (text || "").toLowerCase().trim();
    const fullText = (normalizedText + " " + containerText).trim();

    const FORBIDDEN_KEYWORDS = [
        "submit", "save", "apply", "delete", "remove", "trash", "cancel", "clear",
        "next", "previous", "back", "continue", "sign in", "login", "register",
        "search", "upload", "attach", "download", "close", "ok"
    ];

    if (matches(fullText, ...FORBIDDEN_KEYWORDS)) {
        if (matches(fullText, "submit", "apply", "save")) return { type: "SUBMIT", confidence: 1.0, isForbidden: true };
        if (matches(fullText, "delete", "remove", "trash", "clear")) return { type: "REMOVE_ENTRY", confidence: 1.0, isForbidden: true };
        if (matches(fullText, "next", "continue")) return { type: "NEXT", confidence: 1.0, isForbidden: true };
        if (matches(fullText, "previous", "back")) return { type: "PREVIOUS", confidence: 1.0, isForbidden: true };
        return { type: "FORBIDDEN", confidence: 1.0, isForbidden: true };
    }

    const ADD_TEXT_KEYWORDS = [
        "add", "add another", "add position", "add experience", "add education",
        "add project", "add certification", "add skill", "add language", "add row",
        "add item", "add new", "add more", "create new", "+ add", "add section"
    ];

    const isPlusIcon = text === "+" || text === "＋";
    const textMatch = matches(normalizedText, ...ADD_TEXT_KEYWORDS) || isPlusIcon;

    let sType = null;
    for (const [sName, tax] of Object.entries(SECTION_TAXONOMY)) {
        if (matches(fullText, ...tax.keywords)) {
            sType = sName;
            break;
        }
    }

    let confidence = 0.5;
    if (textMatch && sType) confidence += 0.4;
    else if (textMatch) confidence += 0.25;
    if (isPlusIcon && sType) confidence += 0.35;

    if (confidence >= 0.70) {
        return { type: "ADD_ENTRY", confidence: Math.min(confidence, 1.0), section: sType || "generic", isForbidden: false };
    }

    return { type: "UNKNOWN", confidence, isForbidden: false };
}

// ─── RUNNING TESTS ───────────────────────────────────────────────────────────

console.log("Running AutoForms Dynamic Form Engine Unit Tests...\n");

// 1. Classification Tests for ADD_ENTRY controls
const ctrl1 = classifyControlText("+ Add Position", "Work Experience");
assert.strictEqual(ctrl1.type, "ADD_ENTRY");
assert.strictEqual(ctrl1.section, "experience");
assert.strictEqual(ctrl1.isForbidden, false);

const ctrl2 = classifyControlText("Add Education", "Education section");
assert.strictEqual(ctrl2.type, "ADD_ENTRY");
assert.strictEqual(ctrl2.section, "education");
assert.strictEqual(ctrl2.isForbidden, false);

const ctrl3 = classifyControlText("Add Project", "Projects section");
assert.strictEqual(ctrl3.type, "ADD_ENTRY");
assert.strictEqual(ctrl3.section, "projects");
assert.strictEqual(ctrl3.isForbidden, false);

const ctrl4 = classifyControlText("+", "Certifications section");
assert.strictEqual(ctrl4.type, "ADD_ENTRY");
assert.strictEqual(ctrl4.section, "certifications");
assert.strictEqual(ctrl4.isForbidden, false);

console.log("✅ 1. ADD_ENTRY classification tests passed.");

// 2. Safety Tests for Forbidden Controls
const saveCtrl = classifyControlText("Save Draft", "Application");
assert.strictEqual(saveCtrl.isForbidden, true);
assert.notStrictEqual(saveCtrl.type, "ADD_ENTRY");

const delCtrl = classifyControlText("Delete Application", "Application");
assert.strictEqual(delCtrl.isForbidden, true);

const submitCtrl = classifyControlText("Submit Application", "Application");
assert.strictEqual(submitCtrl.isForbidden, true);

const nextCtrl = classifyControlText("Next Step", "Form");
assert.strictEqual(nextCtrl.isForbidden, true);

console.log("✅ 2. Forbidden controls safety tests passed.");

// 3. Section Entry Math Tests
const mockResumeData = {
    experience: [
        { company: "Company A", role: "Role A" },
        { company: "Company B", role: "Role B" },
        { company: "Company C", role: "Role C" }
    ],
    education: [
        { institution: "School 1", degree: "Degree 1" },
        { institution: "School 2", degree: "Degree 2" }
    ]
};

const expEntries = getResumeEntriesForSection("experience", mockResumeData);
assert.strictEqual(expEntries.length, 3);

const eduEntries = getResumeEntriesForSection("education", mockResumeData);
assert.strictEqual(eduEntries.length, 2);

const projEntries = getResumeEntriesForSection("projects", mockResumeData);
assert.strictEqual(projEntries.length, 0);

console.log("✅ 3. Section entry extraction math tests passed.");

console.log("\nALL DYNAMIC ENGINE UNIT TESTS PASSED! 🎉");
