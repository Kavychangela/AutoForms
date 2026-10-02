// Node test runner for AutoForms extension logic
const assert = require('assert');

// ─── Implementation of matching & helper logic for testing ─────────────────

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

function parsePhoneNumber(phoneStr) {
    if (!phoneStr) return { country_code: "", national_number: "" };
    const trimmed = String(phoneStr).trim();

    if (trimmed.startsWith("+")) {
        const match = trimmed.match(/^\+(\d{1,3})[\s\-]?(\d{6,14})$/);
        if (match) {
            return { country_code: "+" + match[1], national_number: match[2] };
        }
        const digits = trimmed.replace(/\D/g, "");
        if (digits.length > 10) {
            const ccLen = digits.length - 10;
            return { country_code: "+" + digits.slice(0, ccLen), national_number: digits.slice(ccLen) };
        }
        return { country_code: "+" + digits.slice(0, 2), national_number: digits.slice(2) };
    }

    const cleanDigits = trimmed.replace(/\D/g, "");
    if (cleanDigits.length === 10) {
        return { country_code: "", national_number: cleanDigits };
    }
    if (cleanDigits.length === 11 && cleanDigits.startsWith("0")) {
        return { country_code: "", national_number: cleanDigits };
    }
    if (cleanDigits.length === 12 && cleanDigits.startsWith("91")) {
        return { country_code: "+91", national_number: cleanDigits.slice(2) };
    }
    return { country_code: "", national_number: cleanDigits };
}

function resolveEducationPercentage(key, data) {
    if (matches(key, "10th", "tenth", "ssc")) {
        return data.tenth_percentage || null;
    }
    if (matches(key, "12th", "twelfth", "hsc", "intermediate")) {
        return data.twelfth_percentage || null;
    }
    if (matches(key, "college", "university", "degree") && matches(key, "percentage", "marks", "gpa", "cgpa")) {
        return data.gpa || null;
    }
    if (matches(key, "cgpa", "gpa", "percentage", "marks", "aggregate")) {
        return data.gpa || null;
    }
    return null;
}

function classifyUrlField(key) {
    if (matches(key, "linkedin")) return "linkedin";
    if (matches(key, "github")) return "github";
    if (matches(key, "portfolio", "personal site", "personal website", "blog")) return "portfolio";
    if (matches(key, "website", "site", "url")) return "website";
    return null;
}

function isConsentField(key) {
    return matches(key,
        "terms", "condition", "privacy", "consent", "newsletter", "marketing",
        "i agree", "i accept", "i have read", "declaration", "authorize", "authorization"
    );
}

function isHoneypotField(nameOrId) {
    return matches(nameOrId, "honeypot", "hp-field", "bot-field", "spider");
}

function selectOptionByIndex(options, targetIndex) {
    if (typeof targetIndex !== "number" || targetIndex < 0 || targetIndex >= options.length) {
        return null;
    }
    return options[targetIndex];
}

// ─── TEST CASES ─────────────────────────────────────────────────────────────

console.log("Running AutoForms Extension Logic Unit Tests...\n");

// 1. Matching Tests (Avoid Substring False Positives)
assert.strictEqual(matches("statement", "state"), false, "state should not match statement");
assert.strictEqual(matches("cancellation", "cell"), false, "cell should not match cancellation");
assert.strictEqual(matches("Essex", "sex"), false, "sex should not match Essex");
assert.strictEqual(matches("shipping", "pin"), false, "pin should not match shipping");
assert.strictEqual(matches("programming languages", "program"), false, "program should not match programming");
assert.strictEqual(matches("state of residence", "state"), true, "state should match state of residence");
assert.strictEqual(matches("e-mail address", "email", "e-mail"), true, "email should match e-mail address");
console.log("✅ 1. Word boundary matching tests passed.");

// 2. Education Rule Priority Tests
const profileData = {
    tenth_percentage: "92%",
    twelfth_percentage: "88%",
    gpa: "8.5"
};
assert.strictEqual(resolveEducationPercentage("10th percentage", profileData), "92%");
assert.strictEqual(resolveEducationPercentage("12th percentage", profileData), "88%");
assert.strictEqual(resolveEducationPercentage("college percentage", profileData), "8.5");
assert.strictEqual(resolveEducationPercentage("percentage", profileData), "8.5");
console.log("✅ 2. Education rule priority tests passed.");

// 3. Phone Parsing Tests
assert.deepStrictEqual(parsePhoneNumber("+91 9876543210"), { country_code: "+91", national_number: "9876543210" });
assert.deepStrictEqual(parsePhoneNumber("+1 4155551234"), { country_code: "+1", national_number: "4155551234" });
assert.deepStrictEqual(parsePhoneNumber("9876543210"), { country_code: "", national_number: "9876543210" });
assert.deepStrictEqual(parsePhoneNumber("09123456789"), { country_code: "", national_number: "09123456789" });
console.log("✅ 3. Phone parsing tests passed.");

// 4. Consent Checkbox Tests
assert.strictEqual(isConsentField("I agree to the terms and conditions"), true);
assert.strictEqual(isConsentField("Privacy Policy"), true);
assert.strictEqual(isConsentField("Subscribe to newsletter"), true);
assert.strictEqual(isConsentField("Skills and interest"), false);
console.log("✅ 4. Consent checkbox tests passed.");

// 5. Hidden & Honeypot Tests
assert.strictEqual(isHoneypotField("user_honeypot_input"), true);
assert.strictEqual(isHoneypotField("hp-field"), true);
assert.strictEqual(isHoneypotField("first_name"), false);
console.log("✅ 5. Honeypot detection tests passed.");

