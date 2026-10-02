const fillBtn = document.getElementById("fillBtn");
const uploadBtn = document.getElementById("uploadBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const statusEl = document.getElementById("status");

const prefNotice = document.getElementById("prefNotice");
const prefExpectedCtc = document.getElementById("prefExpectedCtc");
const prefGender = document.getElementById("prefGender");
const prefNationality = document.getElementById("prefNationality");
const prefLanguages = document.getElementById("prefLanguages");
const prefDob = document.getElementById("prefDob");

const API_BASE_URL = "https://autoforms-1-x96i.onrender.com";

function setStatus(msg, type = "info") {
    statusEl.textContent = msg;
    statusEl.className = "status " + type;
}

function setLoading(isLoading, text = "Auto Fill") {
    fillBtn.disabled = isLoading;
    if (uploadBtn) uploadBtn.disabled = isLoading;
    fillBtn.textContent = isLoading ? text : "Auto Fill";
}

// Load cached profile on popup open
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["parsedProfile"], (result) => {
        if (result.parsedProfile) {
            populateProfileFields(result.parsedProfile);
            setStatus("Cached profile ready. Click Auto Fill.", "success");
        }
    });
});

function populateProfileFields(profile) {
    if (!profile) return;
    if (prefNotice) prefNotice.value = profile.notice_period || "";
    if (prefExpectedCtc) prefExpectedCtc.value = profile.expected_ctc || "";
    if (prefGender) prefGender.value = profile.gender || "";
    if (prefNationality) prefNationality.value = profile.nationality || "";
    if (prefLanguages) prefLanguages.value = profile.languages || "";
    if (prefDob) prefDob.value = profile.dob || "";
}

function getUpdatedProfile(baseProfile = {}) {
    return {
        ...baseProfile,
        notice_period: prefNotice ? prefNotice.value.trim() || baseProfile.notice_period || "" : baseProfile.notice_period || "",
        expected_ctc: prefExpectedCtc ? prefExpectedCtc.value.trim() || baseProfile.expected_ctc || "" : baseProfile.expected_ctc || "",
        gender: prefGender ? prefGender.value.trim() || baseProfile.gender || "" : baseProfile.gender || "",
        nationality: prefNationality ? prefNationality.value.trim() || baseProfile.nationality || "" : baseProfile.nationality || "",
        languages: prefLanguages ? prefLanguages.value.trim() || baseProfile.languages || "" : baseProfile.languages || "",
        dob: prefDob ? prefDob.value.trim() || baseProfile.dob || "" : baseProfile.dob || ""
    };
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", () => {
        chrome.storage.local.get(["parsedProfile"], (result) => {
            const current = result.parsedProfile || {};
            const updated = getUpdatedProfile(current);
            chrome.storage.local.set({ parsedProfile: updated }, () => {
                setStatus("Profile preferences saved!", "success");
            });
        });
    });
}

async function parseResumeFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/parse-resume`, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
        throw new Error(result.error);
    }
    return result;
}

async function sendFillMessage(profile, resumeId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        throw new Error("No active browser tab found.");
    }

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {
            action: "FILL_FORM",
            data: profile,
            resumeId: resumeId
        }, (fillResponse) => {
            if (chrome.runtime.lastError || !fillResponse) {
                resolve(null);
            } else {
                resolve(fillResponse);
            }
        });
    });
}

// "Parse Resume" separate button handler
if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
        const fileInput = document.getElementById("resumeInput");
        const file = fileInput.files[0];

        if (!file) {
            setStatus("Please select a PDF resume file first.", "error");
            return;
        }

        setLoading(true, "Parsing resume...");
        setStatus("Uploading and parsing resume...", "info");

        try {
            const result = await parseResumeFile(file);
            const updatedProfile = getUpdatedProfile(result);
            chrome.storage.local.set({
                parsedProfile: updatedProfile,
                resumeId: result.resume_id
            });
            populateProfileFields(updatedProfile);
            setStatus("Resume parsed successfully!", "success");
        } catch (err) {
            setStatus("Error: " + err.message, "error");
        } finally {
            setLoading(false);
        }
    });
}

// "Auto Fill" main button handler (Seamless auto-parse + auto-fill flow)
fillBtn.addEventListener("click", async () => {
    const fileInput = document.getElementById("resumeInput");
    const file = fileInput ? fileInput.files[0] : null;

    setLoading(true, "Processing...");

    try {
        let profile = null;
        let resumeId = null;

        // Step 1: If a new file is uploaded, parse it first
        if (file) {
            setStatus("Uploading and parsing resume...", "info");
            const result = await parseResumeFile(file);
            profile = getUpdatedProfile(result);
            resumeId = result.resume_id;

            chrome.storage.local.set({
                parsedProfile: profile,
                resumeId: resumeId
            });
            populateProfileFields(profile);
        } else {
            // Step 2: Fallback to stored profile
            const res = await new Promise(r => chrome.storage.local.get(["parsedProfile", "resumeId"], r));
            if (res.parsedProfile && Object.keys(res.parsedProfile).length > 0) {
                profile = getUpdatedProfile(res.parsedProfile);
                resumeId = res.resumeId || profile.resume_id;
            }
        }

        if (!profile || Object.keys(profile).length === 0) {
            setStatus("Please upload your resume PDF first.", "error");
            setLoading(false);
            return;
        }

        setStatus("Resume ready! Filling form...", "info");

        // Step 3: Trigger fill form message to content script
        const fillResponse = await sendFillMessage(profile, resumeId);

        if (!fillResponse) {
            setStatus("Could not reach page. Please refresh the page.", "error");
        } else {
            const { filled, essayCount } = fillResponse;
            if (essayCount > 0) {
                setStatus(`${filled} fields filled. Generating ${essayCount} AI answer${essayCount > 1 ? "s" : ""}...`, "info");
            } else {
                setStatus(`Done! ${filled} fields filled.`, "success");
            }
        }

    } catch (err) {
        setStatus("Error: " + err.message, "error");
    } finally {
        setLoading(false);
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "ESSAYS_DONE") {
        const total = message.filled;
        const essays = message.essayCount;
        setStatus(
            `Done! ${total} fields filled (including ${essays} AI answer${essays > 1 ? "s" : ""}).`,
            "success"
        );
    }
});