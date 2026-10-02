// ─── Injection guard ─────────────────────────────────────────────────────────
const API_HOSTS = [
    "https://autoforms-1-x96i.onrender.com",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
];

async function postApi(path, payload) {
    let lastError = null;
    for (const host of API_HOSTS) {
        try {
            const res = await fetch(`${host}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError || new Error(`API call failed for ${path}`);
}

if (window.__autoformsAI) {
    // Already running — do nothing
} else {
    window.__autoformsAI = true;
    console.log("✅ AutoForms AI content.js v7 loaded");

    // ─── Shadow DOM piercing queryAll ─────────────────────────────────────────────
    function queryAll(selector, root = document) {
        const results = [];
        function search(r) {
            results.push(...r.querySelectorAll(selector));
            r.querySelectorAll("*").forEach(el => {
                if (el.shadowRoot) search(el.shadowRoot);
            });
        }
        search(root);
        return results;
    }

    function getShadowRoots() {
        const roots = [];
        document.querySelectorAll("*").forEach(el => {
            if (el.shadowRoot) roots.push(el.shadowRoot);
        });
        return roots;
    }

    // ─── Word-aware matching helper ───────────────────────────────────────────────
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

    // ─── Autocomplete attribute map ───────────────────────────────────────────────
    const AUTOCOMPLETE_MAP = {
        "given-name": "first_name",
        "family-name": "last_name",
        "name": "full_name",
        "email": "email",
        "tel": "phone",
        "tel-national": "phone",
        "tel-country-code": "phone_country_code",
        "postal-code": "pincode",
        "address-line1": "address",
        "address-line2": "address",
        "address-level1": "state",
        "address-level2": "city",
        "country": "country",
        "organization": "current_company",
        "bday": "dob"
    };

    // ─── Hidden & Honeypot field guard ────────────────────────────────────────────
    function isFillableField(el) {
        if (!el || !(el instanceof HTMLElement)) return false;
        if (el.dataset.afDone === "true") return false;
        if (el.type === "hidden") return false;
        if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
        if (el.getAttribute("aria-hidden") === "true" || el.closest("[aria-hidden='true']")) return false;

        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            if (el.type !== "file") return false;
        }

        if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) {
            if (el.type !== "file") return false;
        }

        const idName = ((el.id || "") + " " + (el.name || "") + " " + (el.className || "")).toLowerCase();
        if (matches(idName, "honeypot", "hp-field", "bot-field", "spider")) return false;

        const rect = el.getBoundingClientRect();
        if (rect.left < -1000 || rect.top < -1000) return false;

        return true;
    }

    // ─── Phone Number Parsing ─────────────────────────────────────────────────────
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

    // ─── URL Classification ───────────────────────────────────────────────────────
    function classifyUrlField(key) {
        if (matches(key, "linkedin")) return "linkedin";
        if (matches(key, "github")) return "github";
        if (matches(key, "portfolio", "personal site", "personal website", "blog")) return "portfolio";
        if (matches(key, "twitter", "x.com")) return "twitter";
        if (matches(key, "website", "site", "url")) return "website";
        return null;
    }

    // ─── Field Key Extraction ─────────────────────────────────────────────────────
    function getFieldKey(el) {
        const parts = [];

        const auto = el.getAttribute("autocomplete");
        if (auto && AUTOCOMPLETE_MAP[auto]) {
            parts.push(AUTOCOMPLETE_MAP[auto]);
        }

        if (el.name) parts.push(el.name);
        if (el.id) parts.push(el.id);
        if (el.placeholder) parts.push(el.placeholder);
        if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
        if (el.getAttribute("aria-placeholder")) parts.push(el.getAttribute("aria-placeholder"));
        if (el.title) parts.push(el.title);

        if (el.id) {
            const root = el.getRootNode();
            const lbl = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (lbl) parts.push(lbl.innerText?.trim() || "");
        }
        if (el.labels) {
            for (const l of el.labels) {
                const t = l.innerText?.trim();
                if (t) parts.push(t);
            }
        }

        const lblBy = el.getAttribute("aria-labelledby");
        if (lblBy) {
            const root = el.getRootNode();
            lblBy.split(/\s+/).forEach(id => {
                const ref = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
                if (ref) parts.push(ref.innerText?.trim() || "");
            });
        }

        if (parts.filter(p => p.trim()).length >= 2) {
            return parts.join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        }

        let node = el.parentElement;
        while (node && node !== document.body) {
            if (node.getAttribute("data-params")) {
                const firstLine = node.innerText?.split("\n")[0]?.trim() || "";
                if (firstLine) parts.push(firstLine);
                return parts.join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            }
            node = node.parentElement;
        }

        let parent = el.parentElement;
        for (let depth = 0; depth < 5 && parent && parent !== document.body; depth++) {
            const labelEls = parent.querySelectorAll("label, legend");
            for (const lbl of labelEls) {
                if (!lbl.contains(el)) {
                    const t = lbl.innerText?.trim();
                    if (t) { parts.push(t); break; }
                }
            }
            if (parts.filter(p => p.trim()).length >= 1) break;

            const divText = [...parent.querySelectorAll("p, div, span")]
                .find(el2 => !el2.contains(el) && el2.children.length === 0 && el2.innerText?.trim().length > 0);
            if (divText) { parts.push(divText.innerText.trim()); break; }

            parent = parent.parentElement;
        }

        if (parts.filter(p => p.trim()).length === 0) {
            const prev = el.previousElementSibling;
            if (prev && !prev.querySelector("input,select,textarea")) {
                const t = prev.innerText?.slice(0, 80).trim();
                if (t) parts.push(t);
            }
        }

        return parts.join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    }

    function triggerEvents(el) {
        const proto = el.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

        el.dispatchEvent(new Event("focus", { bubbles: true }));

        if (setter) {
            setter.call(el, el.value);
        } else {
            el.value = el.value;
        }

        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
    }

    function fill(el, value) {
        if (!value || typeof value !== "string" && typeof value !== "number") return false;
        if (!isFillableField(el)) return false;
        if (el.value && el.type !== "email") return false;

        const strVal = String(value);

        const proto = el.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

        if (setter) setter.call(el, strVal);
        else el.value = strVal;

        triggerEvents(el);

        if (el.value === strVal) {
            el.dataset.afDone = "true";
            return true;
        }

        if (setter) setter.call(el, strVal);
        else el.value = strVal;
        triggerEvents(el);

        if (el.value === strVal) {
            el.dataset.afDone = "true";
            return true;
        }

        return false;
    }

    // ─── Field value resolver ──────────────────────────────────────────────────────
    function resolveValue(key, type, data) {
        const parsedPhone = parsePhoneNumber(data.phone || data.phone_raw);

        if (type === "url") {
            const urlType = classifyUrlField(key);
            if (urlType === "linkedin") return data.linkedin || null;
            if (urlType === "github") return data.github || null;
            if (urlType === "portfolio") return data.portfolio || data.github || null;
            if (urlType === "twitter") return data.twitter || null;
            return data.portfolio || data.linkedin || data.github || null;
        }

        if (type === "email") return data.email || null;
        if (type === "tel") return parsedPhone.national_number || data.phone || null;

        if (matches(key, "email", "e-mail", "mail id", "custemail")) return data.email || null;
        if (matches(key, "telephone", "tel no", "phone", "mobile", "contact no", "cell", "whatsapp", "contact number")) {
            return parsedPhone.national_number || data.phone || null;
        }

        if (matches(key, "first name", "given name", "fname", "forename")) return data.first_name || data.name?.split(" ")[0] || null;
        if (matches(key, "last name", "surname", "family name", "lname")) return data.last_name || data.name?.split(" ").slice(1).join(" ") || null;
        if (matches(key, "middle name")) return null;
        if (matches(key, "full name", "your name", "applicant name", "candidate name", "customer name", "custname")) return data.name || null;

        if (matches(key, "street address", "address line 1", "address line 2", "address line")) return data.address || null;
        
        if (matches(key, "current city", "your city", "city of residence", "city", "town")) {
            return data.city || null;
        }
        
        if (matches(key, "state", "province", "region")) return data.state || null;
        if (matches(key, "country")) return data.country || null;
        if (matches(key, "pincode", "pin code", "postal", "zip")) return data.pincode || null;
        if (matches(key, "address", "street", "residence")) return data.address || null;

        const urlClass = classifyUrlField(key);
        if (urlClass === "linkedin") return data.linkedin || null;
        if (urlClass === "github") return data.github || null;
        if (urlClass === "portfolio") return data.portfolio || data.github || null;
        if (urlClass === "twitter") return data.twitter || null;
        if (urlClass === "website") return data.portfolio || data.linkedin || data.github || null;

        if (matches(key, "college", "university", "institution", "alma mater", "school name")) return data.college || null;
        if (matches(key, "degree", "qualification", "programme", "program", "course name")) return data.degree || null;
        if (matches(key, "branch", "specialization", "major", "stream", "department")) return data.branch || data.degree || null;
        if (matches(key, "graduation year", "grad year", "pass out", "passing year", "year of graduation", "year of passing")) return data.graduation_year || null;
        if (matches(key, "batch") && data.graduation_year) return data.graduation_year;

        // Precedence: 10th -> 12th -> college -> generic
        if (matches(key, "10th", "tenth", "ssc")) return data.tenth_percentage || null;
        if (matches(key, "12th", "twelfth", "hsc", "intermediate")) return data.twelfth_percentage || null;
        if (matches(key, "college", "university", "degree") && matches(key, "percentage", "marks", "gpa", "cgpa")) return data.gpa || null;
        if (matches(key, "cgpa", "gpa", "percentage", "marks", "aggregate")) return data.gpa || null;

        if (matches(key, "current company", "employer name", "organisation name", "organization name")) return data.current_company || null;
        if (matches(key, "company") && data.current_company) return data.current_company;
        if (matches(key, "designation", "job title", "current role", "current position")) return data.current_role || null;
        if (matches(key, "years of experience", "total experience", "work experience", "experience in years")) return data.experience_years || null;
        if (matches(key, "notice period")) return data.notice_period || null;
        if (matches(key, "current salary", "current ctc")) return data.current_ctc || null;
        if (matches(key, "expected salary", "expected ctc")) return data.expected_ctc || null;

        if (matches(key, "skill")) return Array.isArray(data.skills) ? data.skills.join(", ") : data.skills || null;
        if (matches(key, "summary", "objective", "profile", "about yourself", "about you", "bio") &&
            !matches(key, "location", "number", "id", "date", "organization", "certification", "license", "issue", "expir", "attachment"))
            return data.summary || data.experience || null;
        if (matches(key, "cover letter", "cover note", "motivation letter", "letter of intent")) return data.summary || null;

        if (matches(key, "date of birth", "dob", "birth date")) return data.dob || null;
        if (matches(key, "gender", "sex")) return data.gender || null;
        if (matches(key, "nationality")) return data.nationality || null;
        if (matches(key, "language")) return data.languages || null;

        if (matches(key, "name") &&
            !matches(key,
                "email", "phone", "mobile", "tel", "contact", "whatsapp",
                "company", "college", "university", "school", "institution",
                "skill", "summary", "linkedin", "github", "portfolio",
                "country", "city", "state", "address", "website", "twitter",
                "degree", "branch", "designation", "role", "position", "employer",
                "organisation", "organization", "course", "programme"
            )) {
            return data.name || null;
        }

        return null;
    }

    // ─── Select handler ───────────────────────────────────────────────────────────
    function handleSelect(select, data) {
        if (!isFillableField(select)) return false;
        const key = getFieldKey(select);
        let target = null;
        if (matches(key, "country")) target = data.country;
        else if (matches(key, "gender")) target = data.gender;
        else if (matches(key, "degree", "qualification")) target = data.degree;
        else if (matches(key, "graduation", "batch", "pass out")) target = data.graduation_year;
        else if (matches(key, "notice")) target = data.notice_period;
        else if (matches(key, "experience")) target = data.experience_years;
        if (!target) return false;
        
        const lower = String(target).toLowerCase();
        for (let idx = 0; idx < select.options.length; idx++) {
            const opt = select.options[idx];
            const optText = opt.text.toLowerCase();
            const optVal = opt.value.toLowerCase();
            if (matches(optText, lower) || matches(optVal, lower)) {
                select.selectedIndex = idx;
                triggerEvents(select);
                if (select.selectedIndex === idx) {
                    select.dataset.afDone = "true";
                    console.log(`🔍 [Fill Select] key="${key.slice(0, 60)}" → "${opt.text}"`);
                    return true;
                }
            }
        }
        return false;
    }

    // ─── Checkbox handler (NO legal/consent auto-checking) ────────────────────────
    function handleCheckbox(cb, data) {
        if (!isFillableField(cb) || cb.checked) return false;
        const key = getFieldKey(cb);

        if (matches(key, "terms", "condition", "privacy", "consent", "newsletter", "marketing", "agree", "accept", "i have read", "declaration", "authorize")) {
            return false;
        }
        return false;
    }

    // ─── Radio group handler ──────────────────────────────────────────────────────
    function handleRadioGroups(data) {
        let filled = 0;
        const groups = {};
        queryAll("input[type=radio]").forEach(r => {
            if (!isFillableField(r)) return;
            const g = r.name || r.getAttribute("aria-label") || "_";
            if (!groups[g]) groups[g] = [];
            groups[g].push(r);
        });

        for (const [name, radios] of Object.entries(groups)) {
            if (radios.some(r => r.checked)) continue;
            const gk = name.toLowerCase();
            let target = null;
            if (matches(gk, "gender", "sex") && data.gender) target = data.gender.toLowerCase();
            else if (matches(gk, "available", "availability", "notice")) target = data.notice_period?.toLowerCase();
            else if (matches(gk, "fresher", "experience level")) target = (data.experience_years && data.experience_years !== "0") ? "experienced" : "fresher";
            else if (matches(gk, "qualification", "education level")) target = data.degree?.toLowerCase();
            
            if (!target) continue;

            let best = radios.find(r => matches((r.value + " " + getFieldKey(r)).toLowerCase(), target));
            if (best && !best.checked) {
                best.click();
                triggerEvents(best);
                best.dataset.afDone = "true";
                console.log(`🔍 [Fill Radio] group="${name}" → "${best.value}"`);
                filled++;
            }
        }
        return filled;
    }

    function handleGenderButtons(data) {
        if (!data.gender) return 0;
        const target = data.gender.toLowerCase().trim();
        const genderBtns = [...queryAll("button, [role=radio], [role=button]")].filter(btn => {
            if (!isFillableField(btn)) return false;
            const t = btn.innerText?.toLowerCase().trim();
            return ["male", "female", "others", "other", "non-binary", "prefer not to say"].includes(t);
        });
        if (!genderBtns.length) return 0;
        for (const btn of genderBtns) {
            const isSelected = btn.getAttribute("aria-selected") === "true" || btn.classList.contains("active") || btn.classList.contains("selected");
            if (isSelected) continue;
            const t = btn.innerText?.toLowerCase().trim();
            if (t === target || (target.includes("other") && t.includes("other"))) {
                btn.click();
                btn.dataset.afDone = "true";
                console.log(`🔍 [Fill Gender Button] → "${t}"`);
                return 1;
            }
        }
        return 0;
    }

    function handleSplitPhone(data) {
        let filled = 0;
        const parsed = parsePhoneNumber(data.phone || data.phone_raw);
        if (!parsed.national_number) return filled;

        queryAll("input[type=tel], input[type=number], input[type=text]").forEach(input => {
            if (!isFillableField(input) || input.value) return;
            const key = getFieldKey(input);

            if (matches(key, "country code", "phone code")) {
                if (parsed.country_code && fill(input, parsed.country_code)) {
                    console.log(`🔍 [Fill Phone CC] key="${key}" → "${parsed.country_code}"`);
                    filled++;
                }
                return;
            }

            if (matches(key, "phone", "mobile", "contact", "number", "tel")) {
                if (fill(input, parsed.national_number)) {
                    console.log(`🔍 [Fill Phone National] key="${key}" → "${parsed.national_number}"`);
                    filled++;
                }
            }
        });
        return filled;
    }

    function handleFileInputs(data) {
        let filled = 0;
        queryAll("input[type=file]").forEach(input => {
            if (!isFillableField(input)) return;
            const key = getFieldKey(input);
            if (matches(key, "resume", "cv", "curriculum vitae", "upload resume", "upload cv")) {
                console.log(`[AutoForms] Found resume file input: "${key}"`);
            }
        });
        return filled;
    }

    // ─── AI Selection & Option Matching ──────────────────────────────────────────
    async function aiSelectOptions(question, options, data, multiSelect = false) {
        try {
            const option_items = options.map((text, index) => ({ index, text }));
            const json = await postApi("/ai-select", {
                question,
                options: options,
                option_items: option_items,
                profile: data,
                multi_select: multiSelect,
                form_purpose: detectFormPurpose()
            });
            if (Array.isArray(json.selected_indices)) return json.selected_indices;
            if (typeof json.selected_index === "number") return [json.selected_index];
            return [];
        } catch (e) {
            console.warn("AutoForms AI: /ai-select failed for:", question, e);
            return [];
        }
    }

    function getGroupLabel(firstEl) {
        let node = firstEl.closest("[role=radiogroup], [role=group], fieldset, [data-params]")
            || firstEl.parentElement;
        for (let i = 0; i < 8 && node && node !== document.body; i++) {
            if (node.getAttribute("data-params")) {
                return node.innerText?.split("\n")[0]?.trim() || "";
            }
            const heading = node.querySelector("[role=heading], legend, h1, h2, h3, h4, h5, h6");
            if (heading) return heading.innerText?.trim() || "";
            node = node.parentElement;
        }
        return firstEl.getAttribute("aria-label") || firstEl.getAttribute("aria-labelledby") || "";
    }

    async function handleRadioGroupsWithAI(data) {
        let filled = 0;
        const groups = {};
        queryAll("input[type=radio]").forEach(r => {
            if (!isFillableField(r)) return;
            const g = r.name || "_" + Math.random();
            if (!groups[g]) groups[g] = [];
            groups[g].push(r);
        });

        for (const radios of Object.values(groups)) {
            if (radios.some(r => r.checked)) continue;
            const question = getGroupLabel(radios[0]) || "Select an option";
            const optionTexts = radios.map(r =>
                r.labels?.[0]?.innerText?.trim() ||
                r.getAttribute("aria-label") ||
                r.value || ""
            );
            const selectedIndices = await aiSelectOptions(question, optionTexts, data, false);
            if (!selectedIndices || selectedIndices.length === 0) continue;
            
            const targetIdx = selectedIndices[0];
            if (targetIdx >= 0 && targetIdx < radios.length) {
                const best = radios[targetIdx];
                if (best && !best.checked) {
                    best.click();
                    triggerEvents(best);
                    best.dataset.afDone = "true";
                    console.log(`✅ [AI Radio] "${question}" → "${best.value || best.labels?.[0]?.innerText?.trim() || targetIdx}"`);
                    filled++;
                }
            }
        }
        return filled;
    }

    async function handleGoogleFormsRadiosWithAI(data) {
        let filled = 0;
        const radioGroups = queryAll("[role=radiogroup], [role=listbox]");
        for (const group of radioGroups) {
            const options = [...group.querySelectorAll("[role=radio], [role=option]")];
            if (!options.length) continue;
            if (options.some(o => o.getAttribute("aria-checked") === "true" || o.classList.contains("isSelected"))) continue;
            const question = getGroupLabel(options[0]) || group.getAttribute("aria-label") || "Select an option";
            const optionTexts = options.map(o => o.innerText?.trim() || o.getAttribute("data-value") || "");
            const selectedIndices = await aiSelectOptions(question, optionTexts, data, false);
            if (!selectedIndices || selectedIndices.length === 0) continue;
            
            const targetIdx = selectedIndices[0];
            if (targetIdx >= 0 && targetIdx < options.length) {
                const best = options[targetIdx];
                if (best) {
                    best.click();
                    best.dataset.afDone = "true";
                    console.log(`✅ [AI GForms Radio] "${question}" → "${best.innerText?.trim()}"`);
                    filled++;
                    await new Promise(r => setTimeout(r, 120));
                }
            }
        }
        return filled;
    }

    async function handleCheckboxGroupsWithAI(data) {
        let filled = 0;
        const allCbs = queryAll("input[type=checkbox]");
        if (!allCbs.length) return 0;
        const groups = new Map();
        for (const cb of allCbs) {
            if (!isFillableField(cb) || cb.checked || cb.dataset.aiHandled) continue;
            const container = cb.closest("fieldset") || cb.closest("[role=group]") || cb.parentElement?.parentElement || document.body;
            if (!groups.has(container)) groups.set(container, []);
            groups.get(container).push(cb);
        }
        for (const [, checkboxes] of groups) {
            const question = getGroupLabel(checkboxes[0]) || "Select all that apply";
            if (!question || question.toLowerCase().includes("select all that apply")) continue;
            const optionTexts = checkboxes.map(cb => cb.labels?.[0]?.innerText?.trim() || cb.getAttribute("aria-label") || cb.value || "");
            const selectedIndices = await aiSelectOptions(question, optionTexts, data, true);
            if (!selectedIndices || !selectedIndices.length) continue;
            let groupFilled = 0;
            for (const idx of selectedIndices) {
                if (idx >= 0 && idx < checkboxes.length) {
                    const cb = checkboxes[idx];
                    if (!cb.checked) {
                        cb.checked = true;
                        triggerEvents(cb);
                        cb.dataset.aiHandled = "1";
                        cb.dataset.afDone = "true";
                        groupFilled++;
                    }
                }
            }
            if (groupFilled) {
                console.log(`✅ [AI Checkbox] "${question}" → ${groupFilled} checked`);
                filled += groupFilled;
            }
        }
        return filled;
    }

    async function handleGoogleFormsCheckboxesWithAI(data) {
        let filled = 0;
        const allOpts = queryAll("[role=checkbox]");
        if (!allOpts.length) return 0;
        const groups = new Map();
        for (const opt of allOpts) {
            if (opt.getAttribute("aria-checked") === "true" || opt.dataset.aiHandled) continue;
            let ancestor = opt.parentElement;
            for (let i = 0; i < 10 && ancestor && ancestor !== document.body; i++) {
                if (ancestor.getAttribute("data-params")) break;
                ancestor = ancestor.parentElement;
            }
            if (!groups.has(ancestor)) groups.set(ancestor, []);
            groups.get(ancestor).push(opt);
        }
        for (const [, options] of groups) {
            if (options.some(o => o.getAttribute("aria-checked") === "true")) continue;
            const question = getGroupLabel(options[0]) || "Select all that apply";
            const optionTexts = options.map(o => o.innerText?.trim() || o.getAttribute("data-value") || "");
            const selectedIndices = await aiSelectOptions(question, optionTexts, data, true);
            if (!selectedIndices || !selectedIndices.length) continue;
            let groupFilled = 0;
            for (const idx of selectedIndices) {
                if (idx >= 0 && idx < options.length) {
                    const opt = options[idx];
                    opt.click();
                    opt.dataset.aiHandled = "1";
                    opt.dataset.afDone = "true";
                    groupFilled++;
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            if (groupFilled) {
                console.log(`✅ [AI GForms Checkbox] "${question}" → ${groupFilled} checked`);
                filled += groupFilled;
            }
        }
        return filled;
    }

    // ─── Unified /fill-plan Fallback ─────────────────────────────────────────────
    async function runFillPlanAI(unresolvedFields, data) {
        if (!unresolvedFields.length) return 0;
        let filled = 0;

        try {
            const fieldsInfo = unresolvedFields.map((item, idx) => ({
                id: `f_${idx}`,
                label: item.question,
                field_type: item.type,
                placeholder: item.el.placeholder || "",
                autocomplete: item.el.getAttribute("autocomplete") || "",
                options: item.options || [],
                maxlength: item.el.maxLength > 0 ? item.el.maxLength : null
            }));

            const json = await postApi("/fill-plan", {
                fields: fieldsInfo,
                profile: data,
                form_purpose: detectFormPurpose()
            });

            const plan = json.plan || {};

            unresolvedFields.forEach((item, idx) => {
                const fid = `f_${idx}`;
                const val = plan[fid];
                if (val === null || val === undefined) return;

                if (item.type === "text" || item.type === "textarea") {
                    if (typeof val === "string" && fill(item.el, val)) {
                        console.log(`🔍 [AI FillPlan] "${item.question.slice(0, 40)}" → "${val.slice(0, 30)}"`);
                        filled++;
                    }
                } else if (item.type === "select" && typeof val === "number") {
                    if (val >= 0 && val < item.el.options.length) {
                        item.el.selectedIndex = val;
                        triggerEvents(item.el);
                        item.el.dataset.afDone = "true";
                        console.log(`🔍 [AI FillPlan Select] "${item.question.slice(0, 40)}" → "${item.el.options[val]?.text}"`);
                        filled++;
                    }
                }
            });
        } catch (e) {
            console.warn("AutoForms AI: /fill-plan execution failed", e);
        }

        return filled;
    }

    // ─── Essay Detection and AI Fill ──────────────────────────────────────────────
    const ESSAY_KEYWORDS = [
        "why do you", "why are you", "why should we", "why do you want",
        "tell us about", "tell me about", "describe yourself", "describe your",
        "about yourself", "about you", "strength", "weakness", "achievement",
        "motivat", "passion", "goal", "aspiration", "ambition",
        "cover letter", "cover note", "letter of intent", "sop", "statement of purpose",
        "what makes you", "what can you", "what do you bring",
        "introduce yourself", "short intro", "brief intro",
        "anything else", "additional information", "describe a project", "challenge faced"
    ];

    function isEssayField(input) {
        if (!isFillableField(input)) return false;
        const isTA = input.tagName === "TEXTAREA";
        const isBig = input.type === "text" && input.offsetHeight > 40 && (input.maxLength > 100 || input.maxLength === -1);
        if (!isTA && !isBig) return false;
        return ESSAY_KEYWORDS.some(kw => matches(getFieldKey(input), kw));
    }

    function detectEssayFields() {
        const fields = [];
        queryAll("textarea, input[type=text]").forEach(input => {
            if (!isFillableField(input) || input.value || !isEssayField(input)) return;
            const question = getGroupLabel(input) || getFieldKey(input) || input.placeholder?.trim() || "";
            if (!question) return;
            fields.push({ input, question, maxlength: input.maxLength > 0 ? input.maxLength : null });
        });
        return fields;
    }

    function detectFormPurpose() {
        const sig = (document.title + " " + location.href).toLowerCase();
        if (sig.includes("internship")) return "internship application";
        if (sig.includes("college") || sig.includes("admission")) return "college admission";
        if (sig.includes("scholarship")) return "scholarship application";
        return "job application";
    }

    async function fillEssayField(input, question, data, maxlength) {
        try {
            const json = await postApi("/generate-answer", {
                question, context: data, form_purpose: detectFormPurpose(), maxlength
            });
            if (json.answer && !input.value) {
                if (fill(input, json.answer)) {
                    console.log(`📝 [Essay Answer] "${question.slice(0, 40)}" → generated (${json.answer.length} chars)`);
                    return true;
                }
            }
        } catch (e) { console.warn("AutoForms AI: essay fill failed", question, e); }
        return false;
    }

    // ─── Standard Fill Pass ───────────────────────────────────────────────────────
    function runStandardFill(data) {
        let filled = 0;
        const unresolvedFields = [];

        queryAll(
            "input:not([type=hidden]):not([type=submit]):not([type=button])" +
            ":not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])" +
            ":not([type=password]), textarea"
        ).forEach(input => {
            if (!isFillableField(input) || input.value || isEssayField(input)) return;
            const key = getFieldKey(input);
            console.log(`FIELD: "${key}" | type: ${input.type} | placeholder: "${input.placeholder}"`);
            
            if (input.type === "time") {
                input.value = "09:00";
                triggerEvents(input);
                input.dataset.afDone = "true";
                filled++;
                return;
            }
            if (input.type === "date") {
                if (matches(key, "dob", "birth") && data.dob) {
                    input.value = data.dob;
                    triggerEvents(input);
                    input.dataset.afDone = "true";
                    filled++;
                }
                return;
            }

            const val = resolveValue(key, input.type, data);
            if (val) {
                console.log(`🔍 [Fill] key="${key.slice(0, 60)}" → "${String(val).slice(0, 40)}"`);
                if (fill(input, val)) filled++;
            } else {
                unresolvedFields.push({ el: input, question: key, type: input.tagName === "TEXTAREA" ? "textarea" : "text" });
            }
        });

        queryAll("select").forEach(s => {
            if (!isFillableField(s)) return;
            if (!handleSelect(s, data)) {
                const key = getFieldKey(s);
                const opts = [...s.options].map(o => o.text.trim());
                unresolvedFields.push({ el: s, question: key, type: "select", options: opts });
            } else {
                filled++;
            }
        });

        queryAll("input[type=checkbox]").forEach(cb => {
            if (handleCheckbox(cb, data)) filled++;
        });

        filled += handleRadioGroups(data);
        filled += handleGenderButtons(data);
        filled += handleSplitPhone(data);
        filled += handleFileInputs(data);

        return { filled, unresolvedFields };
    }

    // ─── MutationObserver and Retry loop ──────────────────────────────────────────
    function waitForInputsAndFill(data, maxWaitMs = 5000) {
        return new Promise(resolve => {
            let totalFilled = 0;
            let unresolvedList = [];
            let done = false;

            // Scroll page to force lazy frameworks (React / Vue / Google Forms) to render
            window.scrollTo(0, 300);
            window.dispatchEvent(new Event("scroll"));

            function tryFill() {
                if (done) return;
                const { filled, unresolvedFields } = runStandardFill(data);
                totalFilled += filled;
                if (unresolvedFields.length > 0) {
                    unresolvedList = unresolvedFields;
                }
            }

            tryFill();

            const observer = new MutationObserver(() => tryFill());
            observer.observe(document.body, { childList: true, subtree: true });
            getShadowRoots().forEach(sr => observer.observe(sr, { childList: true, subtree: true }));

            const interval = setInterval(tryFill, 500);

            setTimeout(() => {
                done = true;
                observer.disconnect();
                clearInterval(interval);
                resolve({ totalFilled, unresolvedList });
            }, maxWaitMs);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ─── DYNAMIC FORM ENGINE (Generic Dynamic/Repeating Form Section Handler) ───────
    // ═══════════════════════════════════════════════════════════════════════════════

    const SECTION_TAXONOMY = {
        experience: {
            keywords: ["experience", "work history", "employment", "job history", "positions", "work experience", "career"],
            resumeKeys: ["experience"],
            fallbackFields: ["current_company", "current_role"]
        },
        education: {
            keywords: ["education", "academic", "qualification", "degree", "schooling", "college", "university"],
            resumeKeys: ["education"],
            fallbackFields: ["college", "degree", "branch", "graduation_year", "gpa"]
        },
        projects: {
            keywords: ["project", "projects", "portfolio", "side projects"],
            resumeKeys: ["projects"],
            fallbackFields: []
        },
        certifications: {
            keywords: ["certification", "certifications", "certificate", "license", "licenses", "credentials"],
            resumeKeys: ["certifications", "licenses"],
            fallbackFields: []
        },
        skills: {
            keywords: ["skill", "skills", "technologies", "competencies"],
            resumeKeys: ["skills"],
            fallbackFields: []
        },
        languages: {
            keywords: ["language", "languages"],
            resumeKeys: ["languages"],
            fallbackFields: []
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
            return [{
                company: data.current_company || "",
                role: data.current_role || "",
                start_date: "",
                end_date: "Present",
                description: data.summary || data.experience || ""
            }];
        }
        if (sectionType === "education" && (data.college || data.degree)) {
            return [{
                institution: data.college || "",
                degree: data.degree || "",
                branch: data.branch || "",
                start_date: "",
                end_date: data.graduation_year || "",
                gpa: data.gpa || ""
            }];
        }

        return [];
    }

    function detectSectionContext(el) {
        if (!el || !(el instanceof HTMLElement)) return null;

        let container = el.closest("section, fieldset, form, [role='region'], [role='form'], .form-section, .card, .panel") || el.parentElement;

        for (let depth = 0; depth < 8 && container && container !== document.body; depth++) {
            const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, header, [role='heading'], [data-params]");
            for (const h of headings) {
                const text = (h.innerText || h.getAttribute("aria-label") || "").trim().toLowerCase();
                for (const [sType, tax] of Object.entries(SECTION_TAXONOMY)) {
                    if (matches(text, ...tax.keywords)) {
                        return { container, sectionType: sType, title: text };
                    }
                }
            }

            const containerInfo = ((container.id || "") + " " + (container.className || "") + " " + (container.getAttribute("aria-label") || "")).toLowerCase();
            for (const [sType, tax] of Object.entries(SECTION_TAXONOMY)) {
                if (matches(containerInfo, ...tax.keywords)) {
                    return { container, sectionType: sType, title: containerInfo };
                }
            }

            container = container.parentElement;
        }

        return null;
    }

    function countExistingSectionEntries(container, sectionType) {
        if (!container) return 0;

        const entryCards = container.querySelectorAll(".entry-card, .repeater-item, [data-entry-index], .entry, .item-row");
        if (entryCards.length > 0) {
            return entryCards.length;
        }

        if (sectionType === "experience") {
            const companyInputs = container.querySelectorAll("input:not([type=hidden])");
            let matched = 0;
            companyInputs.forEach(i => {
                const key = getFieldKey(i);
                if (matches(key, "company", "employer", "organization")) matched++;
            });
            return Math.max(matched, 1);
        }

        if (sectionType === "education") {
            const schoolInputs = container.querySelectorAll("input:not([type=hidden])");
            let matched = 0;
            schoolInputs.forEach(i => {
                const key = getFieldKey(i);
                if (matches(key, "school", "college", "university", "institution", "degree")) matched++;
            });
            return Math.max(matched, 1);
        }

        if (sectionType === "projects") {
            const projInputs = container.querySelectorAll("input:not([type=hidden]), textarea");
            let matched = 0;
            projInputs.forEach(i => {
                const key = getFieldKey(i);
                if (matches(key, "project name", "project title", "project description")) matched++;
            });
            return Math.max(matched, 1);
        }

        const fillables = container.querySelectorAll("input:not([type=hidden]), textarea, select");
        return fillables.length > 0 ? 1 : 0;
    }

    function classifyControl(el) {
        if (!el || !(el instanceof HTMLElement)) return { type: "UNKNOWN", confidence: 0 };

        const text = (el.innerText || el.value || el.getAttribute("aria-label") || el.title || "").trim();
        const normalizedText = text.toLowerCase();
        const idClassText = ((el.id || "") + " " + (el.className || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
        const fullText = (normalizedText + " " + idClassText).trim();

        // ── DANGEROUS / FORBIDDEN BUTTONS CHECK ──
        const FORBIDDEN_KEYWORDS = [
            "submit", "save", "apply", "delete", "remove", "trash", "cancel", "clear",
            "next", "previous", "back", "continue", "sign in", "login", "register",
            "search", "upload", "attach", "download", "close", "ok"
        ];

        if (matches(fullText, ...FORBIDDEN_KEYWORDS)) {
            if (matches(fullText, "submit", "apply", "save")) return { type: "SUBMIT", confidence: 1.0, reason: "Forbidden submit/save action" };
            if (matches(fullText, "delete", "remove", "trash", "clear")) return { type: "REMOVE_ENTRY", confidence: 1.0, reason: "Forbidden destructive button" };
            if (matches(fullText, "next", "continue")) return { type: "NEXT", confidence: 1.0, reason: "Navigation button" };
            if (matches(fullText, "previous", "back")) return { type: "PREVIOUS", confidence: 1.0, reason: "Navigation button" };
            return { type: "FORBIDDEN", confidence: 1.0, reason: "Matched forbidden control keyword" };
        }

        // ── ADD_ENTRY SIGNALS ──
        const ADD_TEXT_KEYWORDS = [
            "add", "add another", "add position", "add experience", "add education",
            "add project", "add certification", "add skill", "add language", "add row",
            "add item", "add new", "add more", "create new", "+ add", "add section"
        ];

        const isPlusIcon = text === "+" || text === "＋" || (el.querySelector("svg") !== null && (fullText.includes("add") || fullText.includes("plus") || text.length <= 2));
        const textMatch = matches(normalizedText, ...ADD_TEXT_KEYWORDS) || isPlusIcon;
        const attrMatch = matches(idClassText, "add-btn", "add_btn", "btn-add", "add-entry", "repeater-add", "add-row");

        if (!textMatch && !attrMatch) {
            return { type: "UNKNOWN", confidence: 0, reason: "No add entry signals" };
        }

        const sectionInfo = detectSectionContext(el);
        let confidence = 0.5;

        if (textMatch && sectionInfo) confidence += 0.4;
        else if (textMatch) confidence += 0.25;

        if (attrMatch) confidence += 0.15;
        if (isPlusIcon && sectionInfo) confidence += 0.35;

        if (confidence >= 0.70) {
            return {
                type: "ADD_ENTRY",
                confidence: Math.min(confidence, 1.0),
                section: sectionInfo ? sectionInfo.sectionType : "generic",
                container: sectionInfo ? sectionInfo.container : el.parentElement,
                reason: `Matched add signals (text="${text}") in section "${sectionInfo ? sectionInfo.sectionType : "generic"}"`
            };
        }

        return { type: "UNKNOWN", confidence, reason: "Low confidence for ADD_ENTRY" };
    }

    function fillSpecificSectionEntry(entryCard, sectionType, entryData) {
        if (!entryCard || !entryData) return 0;
        let filled = 0;

        const inputs = entryCard.querySelectorAll("input:not([type=hidden]), textarea, select");
        inputs.forEach(input => {
            if (!isFillableField(input) || input.value) return;
            const key = getFieldKey(input);
            let val = null;

            if (sectionType === "experience") {
                if (matches(key, "company", "employer", "organization", "organisation")) val = entryData.company;
                else if (matches(key, "role", "title", "designation", "position", "job title")) val = entryData.role;
                else if (matches(key, "start date", "from", "joining")) val = entryData.start_date;
                else if (matches(key, "end date", "to", "leaving", "relieving")) val = entryData.end_date;
                else if (matches(key, "description", "summary", "responsibilities")) val = entryData.description;
            } else if (sectionType === "education") {
                if (matches(key, "school", "college", "university", "institution")) val = entryData.institution;
                else if (matches(key, "degree", "qualification")) val = entryData.degree;
                else if (matches(key, "branch", "major", "stream", "specialization")) val = entryData.branch;
                else if (matches(key, "start date", "joining")) val = entryData.start_date;
                else if (matches(key, "end date", "passing year", "graduation year")) val = entryData.end_date || entryData.graduation_year;
                else if (matches(key, "gpa", "cgpa", "percentage", "marks")) val = entryData.gpa || entryData.percentage;
            } else if (sectionType === "projects") {
                if (matches(key, "name", "title", "project name")) val = entryData.name;
                else if (matches(key, "description", "details")) val = entryData.description;
                else if (matches(key, "url", "link")) val = entryData.url || entryData.github;
                else if (matches(key, "technology", "skills", "tech stack")) val = Array.isArray(entryData.technologies) ? entryData.technologies.join(", ") : entryData.technologies;
            } else if (sectionType === "certifications") {
                if (matches(key, "name", "title", "certification")) val = entryData.name || entryData.title;
                else if (matches(key, "authority", "issuer", "org")) val = entryData.authority || entryData.issuer;
                else if (matches(key, "date", "issued")) val = entryData.date;
            } else if (sectionType === "skills") {
                if (matches(key, "skill", "name")) val = typeof entryData === "string" ? entryData : entryData.name;
            } else if (sectionType === "languages") {
                if (matches(key, "language", "name")) val = typeof entryData === "string" ? entryData : entryData.name;
            }

            if (val && fill(input, val)) {
                console.log(`[DYNAMIC] Filled [${sectionType} #${entryCard.getAttribute("data-entry-index") || "new"}] field "${key}" → "${String(val).slice(0, 30)}"`);
                filled++;
            }
        });

        return filled;
    }

    async function runDynamicFormEngine(data) {
        if (!data) return 0;
        console.log("🤖 [DYNAMIC] Running Dynamic Form Engine...");
        let totalFilled = 0;

        const controls = queryAll("button, a, [role='button'], input[type='button']");
        const candidateAddControls = [];

        for (const ctrl of controls) {
            if (!isFillableField(ctrl) && ctrl.type !== "button" && ctrl.tagName !== "BUTTON" && ctrl.tagName !== "A" && ctrl.getAttribute("role") !== "button") continue;
            const classif = classifyControl(ctrl);
            if (classif.type === "ADD_ENTRY" && classif.confidence >= 0.70) {
                candidateAddControls.push({ element: ctrl, ...classif });
            }
        }

        if (candidateAddControls.length === 0) {
            console.log("🤖 [DYNAMIC] No dynamic ADD_ENTRY controls detected.");
            return 0;
        }

        for (const item of candidateAddControls) {
            const ctrl = item.element;
            const sectionType = item.section;
            const container = item.container || ctrl.parentElement;
            
            if (sectionType === "generic" || !sectionType) continue;

            const resumeEntries = getResumeEntriesForSection(sectionType, data);
            const requiredCount = resumeEntries.length;

            if (requiredCount <= 1) {
                const existingCards = container.querySelectorAll(".entry-card, .repeater-item, [data-entry-index], fieldset");
                if (existingCards.length > 0 && resumeEntries.length > 0) {
                    totalFilled += fillSpecificSectionEntry(existingCards[0], sectionType, resumeEntries[0]);
                }
                continue;
            }

            let existingCount = countExistingSectionEntries(container, sectionType);
            console.log(`[DYNAMIC] Section "${sectionType}": Required entries = ${requiredCount}, Existing entries = ${existingCount}`);

            let entryCards = container.querySelectorAll(".entry-card, .repeater-item, [data-entry-index], fieldset");
            for (let i = 0; i < Math.min(existingCount, requiredCount); i++) {
                const card = entryCards[i] || container;
                if (resumeEntries[i]) {
                    totalFilled += fillSpecificSectionEntry(card, sectionType, resumeEntries[i]);
                }
            }

            let clickAttempts = 0;
            const maxClicks = Math.min(requiredCount - existingCount, 5);

            while (existingCount < requiredCount && clickAttempts < maxClicks) {
                const clickCount = parseInt(ctrl.dataset.afAddCount || "0");
                if (clickCount >= 5) {
                    console.warn(`[DYNAMIC] Reached max click attempts for control in section "${sectionType}"`);
                    break;
                }

                console.log(`[DYNAMIC] Creating entry #${existingCount + 1} for section "${sectionType}" (Click attempt ${clickAttempts + 1})`);
                
                const prevFieldCount = container.querySelectorAll("input:not([type=hidden]), textarea").length;
                ctrl.dataset.afAddCount = String(clickCount + 1);
                ctrl.click();
                clickAttempts++;

                // DOM stabilization delay (300ms)
                await new Promise(r => setTimeout(r, 300));

                const newFieldCount = container.querySelectorAll("input:not([type=hidden]), textarea").length;
                entryCards = container.querySelectorAll(".entry-card, .repeater-item, [data-entry-index], fieldset");
                const newExistingCount = Math.max(entryCards.length, countExistingSectionEntries(container, sectionType));

                if (newFieldCount > prevFieldCount || newExistingCount > existingCount) {
                    console.log(`[DYNAMIC] DOM updated successfully for section "${sectionType}". New entry detected.`);
                    const targetIndex = existingCount;
                    if (resumeEntries[targetIndex]) {
                        const newCard = entryCards[targetIndex] || entryCards[entryCards.length - 1] || container;
                        totalFilled += fillSpecificSectionEntry(newCard, sectionType, resumeEntries[targetIndex]);
                    }
                    existingCount = newExistingCount > existingCount ? newExistingCount : existingCount + 1;
                } else {
                    console.warn(`[DYNAMIC] Click on control did not create new fields in section "${sectionType}". Stopping expansion.`);
                    break;
                }
            }
        }

        console.log(`🤖 [DYNAMIC] Dynamic Form Engine completed. ${totalFilled} dynamic section fields filled.`);
        return totalFilled;
    }

    // ─── Main Listener ────────────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action !== "FILL_FORM") return;
        const data = message.data;
        const resumeId = message.resumeId || data.resume_id;

        (async () => {
            console.log("🤖 AutoForms AI: starting form fill automation...");

            // 1. Run Dynamic Form Engine first to handle dynamic repeating sections
            const dynamicFilled = await runDynamicFormEngine(data);

            // 2. Run Standard Fill loop for static/dynamic fields
            const { totalFilled, unresolvedList } = await waitForInputsAndFill(data);

            // 3. Run AI Radio / Checkbox handlers
            console.log("🤖 AutoForms AI: running AI radio/checkbox selection...");
            const [r1, r2, c1, c2] = await Promise.all([
                handleRadioGroupsWithAI(data),
                handleGoogleFormsRadiosWithAI(data),
                handleCheckboxGroupsWithAI(data),
                handleGoogleFormsCheckboxesWithAI(data)
            ]);
            const aiRadioCount = r1 + r2 + c1 + c2;
            console.log(`🤖 AI selection: ${aiRadioCount} radio/checkbox fields filled`);

            // 4. Run AI Fill Plan fallback
            const aiPlanFilled = await runFillPlanAI(unresolvedList, data);

            const totalFormFilled = dynamicFilled + totalFilled + aiRadioCount + aiPlanFilled;

            const essayFields = detectEssayFields();
            const essayCount = essayFields.length;

            sendResponse({
                filled: totalFormFilled,
                essayCount,
                status: essayCount > 0 ? "filling_essays" : "done"
            });

            if (resumeId) {
                postApi("/save-history", {
                    resume_id: resumeId,
                    website: window.location.href,
                    fields_filled: totalFormFilled,
                    ai_answers: essayCount
                }).catch(err => console.warn("[AutoForms] History log failed:", err));
            }

            if (essayCount > 0) {
                let total = totalFormFilled;
                for (const { input, question, maxlength } of essayFields) {
                    if (await fillEssayField(input, question, data, maxlength)) total++;
                }
                chrome.runtime.sendMessage({ action: "ESSAYS_DONE", filled: total, essayCount });
            }
        })();

        return true;
    });

} // end injection guard

