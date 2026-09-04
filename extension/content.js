// ─── Injection guard ─────────────────────────────────────────────────────────
const API_URL = "https://autoforms-1-x96i.onrender.com";
if (window.__autoformsAI) {
    // Already running — do nothing
} else {
    window.__autoformsAI = true;
    console.log("✅ AutoForms AI content.js v6 loaded");

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

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    function getFieldKey(el) {
        const parts = [];

        // ── Tier 1: explicit machine-readable attributes ──
        if (el.name) parts.push(el.name);
        if (el.id) parts.push(el.id);
        if (el.placeholder) parts.push(el.placeholder);
        if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
        if (el.getAttribute("aria-placeholder")) parts.push(el.getAttribute("aria-placeholder"));
        if (el.title) parts.push(el.title);

        // ── Tier 2: <label for="id"> ──
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

        // ── Tier 3: aria-labelledby ──
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

        // ── Tier 4: Google Forms data-params container ──
        let node = el.parentElement;
        while (node && node !== document.body) {
            if (node.getAttribute("data-params")) {
                const firstLine = node.innerText?.split("\n")[0]?.trim() || "";
                if (firstLine) parts.push(firstLine);
                return parts.join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            }
            node = node.parentElement;
        }

        // ── Tier 5: nearest label/legend in DIRECT parent only (max 5 levels) ──
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

            // ── Tier 5b: p/div/span text nodes (for sites like AcquireX) ──
            const divText = [...parent.querySelectorAll("p, div, span")]
                .find(el2 => !el2.contains(el) && el2.children.length === 0 && el2.innerText?.trim().length > 0);
            if (divText) { parts.push(divText.innerText.trim()); break; }

            parent = parent.parentElement;
        }

        // ── Tier 6: immediate previous sibling text ──
        if (parts.filter(p => p.trim()).length === 0) {
            const prev = el.previousElementSibling;
            if (prev && !prev.querySelector("input,select,textarea")) {
                const t = prev.innerText?.slice(0, 80).trim();
                if (t) parts.push(t);
            }
            if (el.parentElement) {
                const parentPrev = el.parentElement.previousElementSibling;
                if (parentPrev && !parentPrev.querySelector("input,select,textarea")) {
                    const t = parentPrev.innerText?.slice(0, 80).trim();
                    if (t) parts.push(t);
                }
            }
        }

        return parts.join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    }

    function matches(key, ...kws) {
        return kws.some(k => key.includes(k));
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
        if (!value) return false;
        if (el.value && el.type !== "email") return false;

        const proto = el.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

        if (setter) setter.call(el, value);
        else el.value = value;

        triggerEvents(el);
        return true;
    }

    // ─── Field value resolver ──────────────────────────────────────────────────────

    function resolveValue(key, type, data) {
        if (type === "email") return data.email;
        if (type === "tel") return data.phone;
        if (type === "url") return data.portfolio || data.linkedin || data.github;

        if (matches(key, "email", "e-mail", "mail id", "custemail")) return data.email;
        if (matches(key, "telephone", "tel no", "phone", "mobile", "contact no", "cell", "whatsapp", "custtel", "contact number")) return data.phone;

        if (matches(key, "first name", "given name", "fname", "forename")) return data.name?.split(" ")[0] || "";
        if (matches(key, "last name", "surname", "family name", "lname")) return data.name?.split(" ").slice(1).join(" ") || "";
        if (matches(key, "middle name")) return "";
        if (matches(key, "full name", "your name", "applicant name", "candidate name", "customer name", "custname")) return data.name;

        if (matches(key, "street address", "address line 1", "address line 2", "address line")) return data.address;
        if (matches(key, "current city", "your city", "city of residence")) return data.city || data.address;
        if (matches(key, "city", "town")) return data.city || data.address;
        if (matches(key, "state", "province", "region")) return data.state;
        if (matches(key, "country")) return data.country || "India";
        if (matches(key, "pincode", "pin code", "postal", "zip")) return data.pincode;
        if (matches(key, "address", "street", "residence")) return data.address;

        if (matches(key, "linkedin")) return data.linkedin;
        if (matches(key, "github")) return data.github;
        if (matches(key, "portfolio", "personal site", "blog")) return data.portfolio || data.github;
        if (matches(key, "website")) return data.portfolio || data.linkedin || data.github;
        if (matches(key, "twitter")) return data.twitter || "";

        if (matches(key, "college", "university", "institution", "alma mater", "school name")) return data.college;
        if (matches(key, "degree", "qualification", "programme", "program", "course name")) return data.degree;
        if (matches(key, "branch", "specialization", "major", "stream", "department")) return data.branch || data.degree;
        if (matches(key, "graduation year", "grad year", "pass out", "passing year", "year of graduation", "year of passing")) return data.graduation_year;
        if (matches(key, "batch") && data.graduation_year) return data.graduation_year;
        if (matches(key, "cgpa", "gpa", "percentage", "marks", "aggregate")) return data.gpa;
        if (matches(key, "10th", "tenth", "ssc")) return data.tenth_percentage;
        if (matches(key, "12th", "twelfth", "hsc", "intermediate")) return data.twelfth_percentage;

        if (matches(key, "current company", "employer name", "organisation name", "organization name")) return data.current_company;
        if (matches(key, "company") && data.current_company) return data.current_company;
        if (matches(key, "designation", "job title", "current role", "current position")) return data.current_role;
        if (matches(key, "years of experience", "total experience", "work experience", "experience in years")) return data.experience_years;
        if (matches(key, "notice period")) return data.notice_period || "Immediate";
        if (matches(key, "current salary", "current ctc")) return data.current_ctc;
        if (matches(key, "expected salary", "expected ctc")) return data.expected_ctc;

        if (matches(key, "skill")) return Array.isArray(data.skills) ? data.skills.join(", ") : data.skills;
        if (matches(key, "summary", "objective", "profile", "about yourself", "about you", "bio") &&
            !matches(key, "location", "number", "id", "date", "organization", "certification", "license", "issue", "expir", "attachment"))
            return data.summary || data.experience;
        if (matches(key, "cover letter", "cover note", "motivation letter", "letter of intent")) return data.summary || "";

        if (matches(key, "date of birth", "dob", "birth date")) return data.dob;
        if (matches(key, "gender", "sex")) return data.gender;
        if (matches(key, "nationality")) return data.nationality || "Indian";
        if (matches(key, "language")) return data.languages || "English, Hindi";

        if (matches(key, "name") &&
            !matches(key,
                "email", "phone", "mobile", "tel", "contact", "whatsapp",
                "company", "college", "university", "school", "institution",
                "skill", "summary", "linkedin", "github", "portfolio",
                "country", "city", "state", "address", "website", "twitter",
                "degree", "branch", "designation", "role", "position", "employer",
                "organisation", "organization", "course", "programme"
            )) {
            return data.name;
        }

        if (!key || key.trim().length < 3) return null;

        if (matches(key, "location", "number", "id number", "license no",
            "issue date", "expir", "issuing org", "certification",
            "attachment", "captcha", "token", "otp", "pin", "coupon",
            "promo", "referral", "voucher", "serial"))
            return null;
    }

    // ─── Select handler ───────────────────────────────────────────────────────────

    function handleSelect(select, data) {
        const key = getFieldKey(select);
        let target = null;
        if (matches(key, "country")) target = data.country || "india";
        else if (matches(key, "gender")) target = data.gender;
        else if (matches(key, "degree", "qualification")) target = data.degree;
        else if (matches(key, "graduation", "batch", "pass out")) target = data.graduation_year;
        else if (matches(key, "notice")) target = data.notice_period || "immediate";
        else if (matches(key, "experience")) target = data.experience_years;
        if (!target) return false;
        const lower = target.toLowerCase();
        for (const opt of select.options) {
            if (opt.text.toLowerCase().includes(lower) || opt.value.toLowerCase().includes(lower)) {
                select.value = opt.value; triggerEvents(select); return true;
            }
        }
        return false;
    }

    // ─── Checkbox handler ─────────────────────────────────────────────────────────

    function getGroupContext(el) {
        let node = el.parentElement;
        while (node && node !== document.body) {
            if (node.tagName === "FIELDSET") {
                const legend = node.querySelector("legend");
                if (legend) return legend.innerText.toLowerCase();
            }
            const heading = node.querySelector("h1,h2,h3,h4,h5,h6,legend");
            if (heading && !heading.contains(el)) return heading.innerText.toLowerCase();
            node = node.parentElement;
        }
        return "";
    }

    function handleCheckbox(cb, data) {
        if (cb.checked) return false;
        const key = getFieldKey(cb);
        const ctx = getGroupContext(cb);

        if (matches(ctx + " " + key, "disability", "criminal", "conviction", "veteran", "authorize", "background check", "drug", "felony")) return false;
        if (matches(key, "agree", "accept", "terms", "condition", "consent", "confirm", "i am", "i have", "i certify", "available", "full time", "full-time", "internship", "relocat", "open to", "willing", "18 years", "above 18", "newsletter", "notification", "privacy")) {
            cb.checked = true; triggerEvents(cb); return true;
        }
        if (matches(ctx, "skill", "technology", "tech stack", "tools")) {
            const skills = (Array.isArray(data.skills) ? data.skills : [data.skills || ""]).map(s => s.toLowerCase());
            if (skills.some(s => key.includes(s) || s.includes(key.trim()))) { cb.checked = true; triggerEvents(cb); return true; }
            return false;
        }
        if (matches(ctx, "work mode", "work type", "location preference")) {
            if (matches(key, "hybrid", "remote")) { cb.checked = true; triggerEvents(cb); return true; }
            return false;
        }
        if (matches(ctx, "job type", "employment type", "opportunity type")) {
            if (matches(key, "full", "intern")) { cb.checked = true; triggerEvents(cb); return true; }
            return false;
        }
        return false;
    }

    // ─── Radio handler ────────────────────────────────────────────────────────────

    function handleRadioGroups(data) {
        let filled = 0;
        const groups = {};
        queryAll("input[type=radio]").forEach(r => {
            const g = r.name || r.getAttribute("aria-label") || "_";
            if (!groups[g]) groups[g] = [];
            groups[g].push(r);
        });
        for (const [name, radios] of Object.entries(groups)) {
            if (radios.some(r => r.checked)) continue;
            const gk = name.toLowerCase();
            let target = null;
            if (matches(gk, "gender", "sex") && data.gender) target = data.gender.toLowerCase();
            else if (matches(gk, "work mode", "work type", "work location")) target = "hybrid";
            else if (matches(gk, "employment", "job type")) target = "full";
            else if (matches(gk, "available", "availability", "notice")) target = data.notice_period?.toLowerCase() || "immediate";
            else if (matches(gk, "fresher", "experience level")) target = (data.experience_years && data.experience_years !== "0") ? "experienced" : "fresher";
            else if (matches(gk, "relocat", "willing")) target = "yes";
            else if (matches(gk, "laptop", "own device")) target = "yes";
            else if (matches(gk, "qualification", "education level")) target = data.degree?.toLowerCase();
            if (!target) {
                if (radios.length <= 5) { radios[0].checked = true; triggerEvents(radios[0]); filled++; }
                continue;
            }
            let best = radios.find(r => (r.value + " " + getFieldKey(r)).toLowerCase().includes(target));
            if (!best && ["yes", "true"].includes(target)) best = radios.find(r => ["yes", "true", "1", "y"].includes(r.value.toLowerCase()));
            if (best) { best.click(); triggerEvents(best); filled++; }
        }
        return filled;
    }

    // ─── Gender / Language / Type button handlers ─────────────────────────────────

    function handleGenderButtons(data) {
        if (!data.gender) return 0;
        const target = data.gender.toLowerCase().trim();
        const genderBtns = [...queryAll("button, [role=radio], [role=button]")].filter(btn => {
            const t = btn.innerText?.toLowerCase().trim();
            return ["male", "female", "others", "other", "non-binary", "prefer not to say"].includes(t);
        });
        if (!genderBtns.length) return 0;
        for (const btn of genderBtns) {
            const t = btn.innerText?.toLowerCase().trim();
            if (t === target || (target.includes("other") && t.includes("other"))) { btn.click(); return 1; }
        }
        return 0;
    }

    function handleLanguageButtons(data) {
        if (!data.languages) return 0;
        const userLangs = data.languages.toLowerCase().split(/[,\/]/).map(l => l.trim());
        let clicked = 0;
        let langSection = null;
        queryAll("*").forEach(el => {
            const text = el.innerText?.trim().toLowerCase();
            if ((text === "languages you know" || text === "languages") && el.children.length < 5) {
                langSection = el.closest("section, div, form") || el.parentElement?.parentElement;
            }
        });
        const btns = langSection
            ? [...langSection.querySelectorAll("button, [role=button]")]
            : [...queryAll("button, [role=button]")];
        btns.forEach(btn => {
            const label = btn.innerText?.toLowerCase().replace(/[^a-z]/g, "").trim();
            if (!label || label.includes("add")) return;
            if (userLangs.some(lang => lang.replace(/[^a-z]/g, "") === label || label.includes(lang.replace(/[^a-z]/g, "")))) {
                const isSelected = btn.getAttribute("aria-selected") === "true" || btn.classList.contains("active") || btn.classList.contains("selected");
                if (!isSelected) { btn.click(); clicked++; }
            }
        });
        return clicked;
    }

    function handleTypeButtons(data) {
        const expYears = parseFloat(data.experience_years) || 0;
        const targetType = expYears > 0 ? "working professional" : "fresher";
        let typeSection = null;
        queryAll("*").forEach(el => {
            const text = el.innerText?.trim().toLowerCase();
            if (text === "type" && el.children.length < 5) {
                typeSection = el.closest("section, div, form") || el.parentElement?.parentElement;
            }
        });
        const btns = typeSection
            ? [...typeSection.querySelectorAll("button, [role=button]")]
            : [...queryAll("button, [role=button]")];
        const typeOptions = ["college student", "fresher", "working professional", "school student", "woman returning to work"];
        for (const btn of btns) {
            const label = btn.innerText?.toLowerCase().trim();
            if (!typeOptions.includes(label)) continue;
            const isSelected = btn.getAttribute("aria-selected") === "true" || btn.classList.contains("active") || btn.classList.contains("selected");
            if (isSelected) return 0;
            if (label.includes(targetType) || (targetType === "fresher" && label === "college student")) { btn.click(); return 1; }
        }
        return 0;
    }

    function handleRangeSliders(data) {
        let filled = 0;
        queryAll("input[type=range]").forEach(slider => {
            if (slider.dataset.autofilled) return;
            const key = getFieldKey(slider);
            const min = parseFloat(slider.min || 0), max = parseFloat(slider.max || 100);
            let value = null;
            if (matches(key, "experience", "years")) value = Math.min(Math.max(parseFloat(data.experience_years) || 0, min), max);
            else if (matches(key, "skill", "proficiency", "rating")) value = Math.round(min + (max - min) * 0.8);
            else if (matches(key, "salary", "ctc")) value = Math.min(Math.max(parseFloat(data.expected_ctc) || 0, min), max);
            if (value !== null) { slider.value = value; slider.dataset.autofilled = "1"; triggerEvents(slider); filled++; }
        });
        return filled;
    }

    function handleContentEditable(data) {
        let filled = 0;
        queryAll("[contenteditable='true']").forEach(el => {
            if (el.innerText.trim()) return;
            const value = resolveValue(getFieldKey(el), "text", data);
            if (value) { el.innerText = value; el.dispatchEvent(new Event("input", { bubbles: true })); filled++; }
        });
        return filled;
    }

    function handleSplitPhone(data) {
        let filled = 0;
        if (!data.phone) return filled;
        const raw = data.phone.replace(/^[+]?\d{1,3}[\s\-]?/, "").trim();
        queryAll("input[type=tel], input[type=number]").forEach(input => {
            if (input.value) return;
            if (input.offsetWidth < 60) return;
            const key = getFieldKey(input);
            if (matches(key, "phone", "mobile", "contact", "number", "tel")) {
                const maxLen = parseInt(input.maxLength) || 15;
                input.value = maxLen <= 11 ? raw : data.phone;
                triggerEvents(input);
                filled++;
            }
        });
        return filled;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ─── AI-POWERED RADIO & CHECKBOX SELECTION ────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════════════

    async function aiSelectOptions(question, options, data, multiSelect = false) {
        try {


            const res = await fetch(`${API_URL}/ai-select`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question,
                    options,
                    profile: data,
                    multi_select: multiSelect,
                    form_purpose: detectFormPurpose()
                })
            });
            if (!res.ok) return [];
            const json = await res.json();
            if (Array.isArray(json.selected)) return json.selected.map(s => s.toLowerCase().trim());
            if (typeof json.selected === "string") return [json.selected.toLowerCase().trim()];
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
            const chosen = await aiSelectOptions(question, optionTexts, data, false);
            if (!chosen.length) continue;
            const best = radios.find(r => {
                const label = ((r.value || "") + " " + (r.labels?.[0]?.innerText || "") + " " + (r.getAttribute("aria-label") || "")).toLowerCase();
                return chosen.some(c => label.includes(c) || c.includes(label.trim()));
            });
            if (best) { best.click(); triggerEvents(best); console.log(`✅ [AI Radio] "${question}" → "${best.value}"`); filled++; }
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
            const chosen = await aiSelectOptions(question, optionTexts, data, false);
            if (!chosen.length) continue;
            function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }
            const best = options.find(o => {
                const label = (o.innerText?.trim() || o.getAttribute("data-value") || "").toLowerCase();
                return chosen.some(c => { const a = normalize(label); const b = normalize(c); return a.includes(b) || b.includes(a); });
            });
            if (best) { best.click(); console.log(`✅ [AI GForms Radio] "${question}" → "${best.innerText?.trim()}"`); filled++; await new Promise(r => setTimeout(r, 120)); }
        }
        return filled;
    }

    async function handleCheckboxGroupsWithAI(data) {
        let filled = 0;
        const allCbs = queryAll("input[type=checkbox]");
        if (!allCbs.length) return 0;
        const groups = new Map();
        for (const cb of allCbs) {
            if (cb.checked || cb.dataset.aiHandled) continue;
            const container = cb.closest("fieldset") || cb.closest("[role=group]") || cb.parentElement?.parentElement || document.body;
            if (!groups.has(container)) groups.set(container, []);
            groups.get(container).push(cb);
        }
        for (const [, checkboxes] of groups) {
            const question = getGroupLabel(checkboxes[0]) || "Select all that apply";
            if (!question || question.toLowerCase().includes("select all that apply")) continue;
            const optionTexts = checkboxes.map(cb => cb.labels?.[0]?.innerText?.trim() || cb.getAttribute("aria-label") || cb.value || "");
            const chosen = await aiSelectOptions(question, optionTexts, data, true);
            if (!chosen.length) continue;
            let groupFilled = 0;
            for (const cb of checkboxes) {
                const label = ((cb.labels?.[0]?.innerText?.trim() || "") + " " + (cb.getAttribute("aria-label") || "") + " " + (cb.value || "")).toLowerCase();
                if (chosen.some(c => label.includes(c) || c.includes(label.trim()))) {
                    cb.checked = true; triggerEvents(cb); cb.dataset.aiHandled = "1"; groupFilled++;
                }
            }
            if (groupFilled) { console.log(`✅ [AI Checkbox] "${question}" → ${groupFilled} checked`); filled += groupFilled; }
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
            const chosen = await aiSelectOptions(question, optionTexts, data, true);
            if (!chosen.length) continue;
            let groupFilled = 0;
            for (const opt of options) {
                const label = (opt.innerText?.trim() || opt.getAttribute("data-value") || "").toLowerCase();
                if (chosen.some(c => label.includes(c) || c.includes(label))) {
                    opt.click(); opt.dataset.aiHandled = "1"; groupFilled++;
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            if (groupFilled) { console.log(`✅ [AI GForms Checkbox] "${question}" → ${groupFilled} checked`); filled += groupFilled; }
        }
        return filled;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ─── Essay detection and AI fill ──────────────────────────────────────════════
    // ═══════════════════════════════════════════════════════════════════════════════

    const ESSAY_KEYWORDS = [
        "why do you", "why are you", "why should we", "why do you want",
        "tell us about", "tell me about", "describe yourself", "describe your",
        "about yourself", "about you", "strength", "weakness", "achievement",
        "motivat", "passion", "goal", "aspiration", "ambition",
        "cover letter", "cover note", "letter of intent", "sop", "statement of purpose",
        "what makes you", "what can you", "what do you bring",
        "introduce yourself", "short intro", "brief intro",
        "anything else", "additional information", "anything you want us to know"
    ];

    function isEssayField(input) {
        const isTA = input.tagName === "TEXTAREA";
        const isBig = input.type === "text" && input.offsetHeight > 40 && (input.maxLength > 100 || input.maxLength === -1);
        if (!isTA && !isBig) return false;
        return ESSAY_KEYWORDS.some(kw => getFieldKey(input).includes(kw));
    }

    function detectEssayFields() {
        const fields = [];
        queryAll("textarea, input[type=text]").forEach(input => {
            if (input.value || !isEssayField(input)) return;
            const question =
                input.labels?.[0]?.innerText?.trim() ||
                input.getAttribute("aria-label")?.trim() ||
                input.placeholder?.trim() ||
                "Tell us about yourself";
            fields.push({ input, question });
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

    async function fillEssayField(input, question, data) {
        try {
            const res = await fetch(`${API_URL}/generate-answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, context: data, form_purpose: detectFormPurpose() })
            });
            const json = await res.json();
            if (json.answer && !input.value) { input.value = json.answer; triggerEvents(input); return true; }
        } catch (e) { console.warn("AutoForms AI: essay fill failed", question, e); }
        return false;
    }

    // ─── Standard fill pass ───────────────────────────────────────────────────────

    function runStandardFill(data) {
        let filled = 0;

        queryAll(
            "input:not([type=hidden]):not([type=submit]):not([type=button])" +
            ":not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])" +
            ":not([type=password]), textarea"
        ).forEach(input => {
            if (input.value || isEssayField(input)) return;
            const key = getFieldKey(input);
            console.log(`FIELD: "${key}" | type: ${input.type} | placeholder: "${input.placeholder}"`);
            if (input.type === "time") { input.value = "09:00"; triggerEvents(input); filled++; return; }
            if (input.type === "date") { if (matches(key, "dob", "birth") && data.dob) { input.value = data.dob; triggerEvents(input); filled++; } return; }
            const val = resolveValue(key, input.type, data);
            if (val) console.log(`🔍 [Fill] key="${key.slice(0, 60)}" → "${String(val).slice(0, 40)}"`);
            if (fill(input, val)) filled++;
        });

        queryAll("select").forEach(s => { if (handleSelect(s, data)) filled++; });

        queryAll("input[type=checkbox]").forEach(cb => {
            if (!cb.offsetParent) return;
            if (cb.offsetWidth === 0 || cb.offsetHeight === 0) return;
            if (handleCheckbox(cb, data)) filled++;
        });

        filled += handleRadioGroups(data);
        filled += handleRangeSliders(data);
        filled += handleContentEditable(data);
        filled += handleGenderButtons(data);
        filled += handleLanguageButtons(data);
        filled += handleTypeButtons(data);
        filled += handleSplitPhone(data);
        return filled;
    }

    // ─── MutationObserver retry loop ──────────────────────────────────────────────

    function waitForInputsAndFill(data, maxWaitMs = 5000) {
        return new Promise(resolve => {
            let filled = 0;
            let done = false;

            // Force React to render the form by scrolling
            window.scrollTo(0, 300);
            window.dispatchEvent(new Event("scroll"));

            function tryFill() {
                const inputs = queryAll("input:not([type=hidden]), textarea");
                if (!done && inputs.length > 1) {
                    filled += runStandardFill(data);
                }
            }

            const observer = new MutationObserver(() => tryFill());
            observer.observe(document.body, { childList: true, subtree: true });

            // Also observe shadow roots
            getShadowRoots().forEach(sr => {
                observer.observe(sr, { childList: true, subtree: true });
            });

            const interval = setInterval(tryFill, 500);

            setTimeout(() => {
                done = true;
                observer.disconnect();
                clearInterval(interval);
                resolve(filled);
            }, maxWaitMs);
        });
    }

    // ─── Main listener ────────────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action !== "FILL_FORM") return;
        const data = message.data;

        (async () => {
            const filled = await waitForInputsAndFill(data);

            console.log("🤖 AutoForms AI: running AI radio/checkbox selection...");
            const [r1, r2, c1, c2] = await Promise.all([
                handleRadioGroupsWithAI(data),
                handleGoogleFormsRadiosWithAI(data),
                handleCheckboxGroupsWithAI(data),
                handleGoogleFormsCheckboxesWithAI(data)
            ]);
            const aiCount = r1 + r2 + c1 + c2;
            const totalFilled = filled + aiCount;
            console.log(`🤖 AI selection: ${aiCount} radio/checkbox fields filled`);

            const essayFields = detectEssayFields();
            const essayCount = essayFields.length;

            sendResponse({
                filled: totalFilled,
                essayCount,
                status: essayCount > 0 ? "filling_essays" : "done"
            });

            fetch(`${API_URL}/save-history`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    resume_id: message.resumeId || 1, // temp fallback
                    website: window.location.href,
                    fields_filled: totalFilled,
                    ai_answers: essayCount
                })
            });

            if (essayCount > 0) {
                let total = totalFilled;
                for (const { input, question } of essayFields) {
                    if (await fillEssayField(input, question, data)) total++;
                }
                chrome.runtime.sendMessage({ action: "ESSAYS_DONE", filled: total, essayCount });
            }
        })();

        return true;
    });

} // end injection guard