const fillBtn = document.getElementById("fillBtn");
const statusEl = document.getElementById("status");

function setStatus(msg, type = "info") {
    statusEl.textContent = msg;
    statusEl.className = "status " + type;
}

function setLoading(isLoading) {
    fillBtn.disabled = isLoading;
    fillBtn.textContent = isLoading ? "Parsing resume..." : "Auto Fill";
}

fillBtn.addEventListener("click", async () => {
    const fileInput = document.getElementById("resumeInput");
    const file = fileInput.files[0];

    if (!file) {
        setStatus("Please upload a resume first.", "error");
        return;
    }

    setLoading(true);
    setStatus("Uploading and parsing resume...", "info");

    try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("http://localhost:8000/parse-resume", {
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

        setStatus("Resume parsed! Filling form...", "info");

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Small delay to ensure content script listener is ready
        await new Promise(r => setTimeout(r, 100));

        // Send parsed data and await the response properly
        const fillResponse = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, {
                action: "FILL_FORM",
                data: result
            }, (res) => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(res);
            });
        });

        if (!fillResponse) {
            setStatus("Could not reach the page. Try refreshing.", "error");
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

// Listen for essay fill completion from content script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "ESSAYS_DONE") {
        const total = message.filled;
        const essays = message.essayCount;
        setStatus(
            `Done! ${total} fields filled (including ${essays} AI-generated answer${essays > 1 ? "s" : ""}).`,
            "success"
        );
    }
});