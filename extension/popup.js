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

function setStatus(msg, type = "info") {
    statusEl.textContent = msg;
    statusEl.className = "status " + type;
}

function setLoading(isLoading, text = "Auto Fill") {
    fillBtn.disabled = isLoading;
    uploadBtn.disabled = isLoading;
    fillBtn.textContent = isLoading ? text : "Auto Fill Current Form";
}

// Load cached profile on popup open
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["parsedProfile"], (result) => {
        if (result.parsedProfile) {
            populateProfileFields(result.parsedProfile);
            setStatus("Cached profile loaded. Ready to auto fill!", "success");
        }
    });
});

function populateProfileFields(profile) {
    if (!profile) return;
    prefNotice.value = profile.notice_period || "";
    prefExpectedCtc.value = profile.expected_ctc || "";
    prefGender.value = profile.gender || "";
    prefNationality.value = profile.nationality || "";
    prefLanguages.value = profile.languages || "";
    prefDob.value = profile.dob || "";
}

function getUpdatedProfile(baseProfile = {}) {
    return {
        ...baseProfile,
        notice_period: prefNotice.value.trim() || baseProfile.notice_period || "",
        expected_ctc: prefExpectedCtc.value.trim() || baseProfile.expected_ctc || "",
        gender: prefGender.value.trim() || baseProfile.gender || "",
        nationality: prefNationality.value.trim() || baseProfile.nationality || "",
        languages: prefLanguages.value.trim() || baseProfile.languages || "",
        dob: prefDob.value.trim() || baseProfile.dob || ""
    };
}

saveProfileBtn.addEventListener("click", () => {
    chrome.storage.local.get(["parsedProfile"], (result) => {
        const current = result.parsedProfile || {};
        const updated = getUpdatedProfile(current);
        chrome.storage.local.set({ parsedProfile: updated }, () => {
            setStatus("Profile preferences saved!", "success");
        });
    });
});

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
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("https://autoforms-1-x96i.onrender.com/parse-resume", {
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

        const updatedProfile = getUpdatedProfile(result);
        chrome.storage.local.set({
            parsedProfile: updatedProfile,
            resumeId: result.resume_id
        });

        populateProfileFields(updatedProfile);
        setStatus("Resume parsed successfully! You can now Auto Fill.", "success");

    } catch (err) {
        setStatus("Error parsing resume: " + err.message, "error");
    } finally {
        setLoading(false);
    }
});

fillBtn.addEventListener("click", async () => {
    chrome.storage.local.get(["parsedProfile", "resumeId"], async (res) => {
        const profile = getUpdatedProfile(res.parsedProfile || {});

        if (!profile || Object.keys(profile).length === 0) {
            setStatus("No profile found. Please upload a resume first.", "error");
            return;
        }

        const resumeId = res.resumeId || profile.resume_id;
        if (!resumeId) {
            setStatus("Warning: No resumeId found in profile.", "error");
        }

        setLoading(true, "Filling form...");
        setStatus("Filling form fields...", "info");

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                setStatus("No active tab found.", "error");
                return;
            }

            chrome.tabs.sendMessage(tab.id, {
                action: "FILL_FORM",
                data: profile,
                resumeId: resumeId
            }, (fillResponse) => {
                setLoading(false);
                if (chrome.runtime.lastError || !fillResponse) {
                    setStatus("Could not reach the page. Try refreshing.", "error");
                    return;
                }

                const { filled, essayCount } = fillResponse;
                if (essayCount > 0) {
                    setStatus(`${filled} fields filled. Generating ${essayCount} AI answer${essayCount > 1 ? "s" : ""}...`, "info");
                } else {
                    setStatus(`Done! ${filled} fields filled.`, "success");
                }
            });

        } catch (err) {
            setStatus("Error: " + err.message, "error");
            setLoading(false);
        }
    });
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