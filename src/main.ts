import { GeminiService } from "./services/ai.service";
import { DocxService } from "./services/docx.service";
import { ResumeData } from "./types/resume";
import baseResume from "./data/resumes/base_resume.json";

document.addEventListener('DOMContentLoaded', async () => {
    const submitBtn = document.getElementById('submitButton') as HTMLButtonElement;
    const jdInput = document.getElementById('descriptionInput') as HTMLTextAreaElement;
    const qInput = document.getElementById('questionInput') as HTMLInputElement;
    const companyInput = document.getElementById('companyInput') as HTMLInputElement;
    const positionInput = document.getElementById('positionInput') as HTMLInputElement;
    const statusMsg = document.getElementById('statusMessage') as HTMLDivElement;
    const resultContainer = document.getElementById('resultContainer') as HTMLDivElement;
    const settingsBtn = document.getElementById('settingsButton') as HTMLButtonElement;
    const homeView = document.getElementById('homeView') as HTMLDivElement;
    const settingsView = document.getElementById('settingsView') as HTMLDivElement;
    const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    const saveSettingsBtn = document.getElementById('saveSettings') as HTMLButtonElement;

    // Load Settings
    const settings = await chrome.storage.local.get(['apiKey', 'resumeProfile']);
    if (settings.apiKey) apiKeyInput.value = settings.apiKey;

    // Always use base_resume.json as the master source of truth
    // This ensures that edits to the file are picked up immediately
    const currentProfile: ResumeData = baseResume as any;

    // Save it to storage just so other parts of the extension (if any) can see it, 
    // but we use the file's data for the current session.
    await chrome.storage.local.set({ resumeProfile: currentProfile });

    // Track previous tailoring state for follow-up instructions
    let lastTailoredData: any = null;
    let lastJdRules: any = null;

    settingsBtn.onclick = () => {
        homeView.classList.toggle('hidden');
        settingsView.classList.toggle('hidden');
    };

    saveSettingsBtn.onclick = async () => {
        const apiKey = apiKeyInput.value.trim();
        await chrome.storage.local.set({ apiKey });
        showStatus('Settings saved!', 'success');
        setTimeout(() => {
            homeView.classList.remove('hidden');
            settingsView.classList.add('hidden');
        }, 1000);
    };

    submitBtn.addEventListener('click', async () => {
        const jd = jdInput.value.trim();
        const question = qInput.value.trim();
        const company = companyInput.value.trim();
        const position = positionInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showStatus('Please set your API Key in Settings.', 'error');
            return;
        }

        if (!jd || !question) {
            showStatus('Please fill in JD and Intent.', 'error');
            return;
        }

        submitBtn.disabled = true;
        showStatus('AI is working...', '');
        resultContainer.innerHTML = '';

        try {
            const aiService = new GeminiService(apiKey);
            const docxService = new DocxService();

            // AI-powered Intent Detection
            showStatus('Understanding your request...', '');
            const { intent, directives, question: extractedQuestion } = await aiService.detectIntent(question);

            if (directives.length > 0) {
                console.log('User directives detected:', directives);
            }

            if (intent === "tailor") {
                let tailoredData: any;
                let jdRules: any;

                if (directives.length > 0 && lastTailoredData && lastJdRules) {
                    // Follow-up: only re-tailor the most recent experience
                    showStatus('Applying changes to most recent experience...', '');
                    ({ tailoredData, jdRules } = await aiService.processFollowUpTailoring(lastTailoredData, lastJdRules, directives));
                } else {
                    // First run: full tailoring pipeline
                    showStatus('Tailoring resume...', '');
                    ({ tailoredData, jdRules } = await aiService.processResumeTailoring(currentProfile, jd, directives));
                }

                // Store for follow-up use
                lastTailoredData = tailoredData;
                lastJdRules = jdRules;

                const blob = await docxService.generateResume(tailoredData);
                showFileResult(blob, company, position, jd);
                showStatus('Resume tailored successfully!', 'success');
            } else if (intent === "cover_letter") {
                showStatus('Writing cover letter...', '');
                const content = await aiService.generateCoverLetter(currentProfile, jd, directives);
                showTextResult(content);
                showStatus('Cover letter generated!', 'success');
            } else {
                showStatus('Answering question...', '');
                const content = await aiService.answerQuestion(currentProfile, jd, extractedQuestion, directives);
                showTextResult(content);
                showStatus('Answer generated!', 'success');
            }

        } catch (error: any) {
            console.error(error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    function showStatus(text: string, type: string) {
        statusMsg.textContent = text;
        statusMsg.className = 'status-message ' + (type ? `status-${type}` : '');
    }

    function showTextResult(text: string) {
        resultContainer.style.display = 'block';
        const div = document.createElement('div');
        div.className = 'text-result';
        div.textContent = text;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button';
        copyBtn.textContent = 'Copy to Clipboard';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = 'Copy to Clipboard', 2000);
        };

        resultContainer.appendChild(div);
        resultContainer.appendChild(copyBtn);
    }

    function showFileResult(blob: Blob, company: string, position: string, jd: string) {
        resultContainer.style.display = 'block';
        
        const btnContainer = document.createElement('div');
        btnContainer.className = 'button-group';

        // 1. Download Button (Simple name)
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-button';
        const holderName = (currentProfile.personal_info.name || "resume").replace(/\s+/g, '_').toLowerCase();
        downloadBtn.innerHTML = `<span>📥</span> Download (${holderName}_resume.docx)`;
        
        downloadBtn.onclick = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${holderName}_resume.docx`;
            a.click();
            URL.revokeObjectURL(url);
        };

        // 2. Save Button (Organized folder)
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-button';
        saveBtn.innerHTML = '<span>💾</span> Save All (Resume + JD)';
        
        saveBtn.onclick = async () => {
            const date = new Date().toISOString().split('T')[0];
            const safeCompany = (company || "Company").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const safePosition = (position || "Position").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const basePath = `resumes/${date}/${safeCompany}_${safePosition}`;
            
            // Download Resume
            const resumeReader = new FileReader();
            resumeReader.onload = () => {
                chrome.downloads.download({
                    url: resumeReader.result as string,
                    filename: `${basePath}.docx`,
                    saveAs: false
                });
            };
            resumeReader.readAsDataURL(blob);

            // Download JD
            const jdBlob = new Blob([jd], { type: 'text/plain' });
            const jdReader = new FileReader();
            jdReader.onload = () => {
                chrome.downloads.download({
                    url: jdReader.result as string,
                    filename: `${basePath}_jd.txt`,
                    saveAs: false
                });
            };
            jdReader.readAsDataURL(jdBlob);
        };

        btnContainer.appendChild(downloadBtn);
        btnContainer.appendChild(saveBtn);
        resultContainer.appendChild(btnContainer);
    }
});
