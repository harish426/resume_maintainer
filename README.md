# 📝 Resume Tailor Extension (v2.0)

A powerful, **standalone TypeScript Chrome Extension** that uses Google Gemini AI to surgically tailor your resume for any Job Description (JD). No backend required – 100% serverless and private.

## 🚀 Features
- **Surgical Tailoring**: ATS-optimized bullet point editing based on JD requirements.
- **Smart Organization**: Automatically saves resumes into structured folders: `Downloads/resumes/YYYY-MM-DD/company_position.docx`.
- **JD Archiving**: Saves the original Job Description alongside your resume for future reference.
- **AI Career Coach**: Generate professional cover letters and interview answers grounded in your actual experience.
- **Pro Typography**: Perfectly formatted DOCX output with refined 9pt typography.

---

## 📂 Resume Data Management

To keep things simple and stable, the extension is hard-wired to use a single base resume file.

### 1. Folder Location & Filename
Your base resume must be placed exactly here:
`frontend/src/data/resumes/base_resume.json`

### 2. How to update
If you want to change your base resume data:
1. Edit the `base_resume.json` file in resume_maintainer/src/data/resumes/base_resume.
2. Run `npm run build` in the `resume_maintainer` directory.
3. Reload the extension in Chrome.

### 3. JSON Structure Template
The extension depends on a specific JSON structure. Use the existing `src/data/resumes/base_resume.json` as your reference template:

```json
{
  "personal_info": {
    "name": "Your Full Name",
    "email": "email@example.com",
    "phone": "123-456-7890",
    "linkedin": "https://linkedin.com/in/yourprofile",
    "github": "https://github.com/youruser",
    "portfolio": "https://yourportfolio.com"
  },
  "technologies": {
    "Category Name": ["Skill 1", "Skill 2"]
  },
  "professional_experience": [
    {
      "client": "Company Name",
      "location": "City, Country",
      "role": "Job Title",
      "duration": "Duration",
      "responsibilities": ["Bullet point 1", "Bullet point 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "url": "optional-link",
      "description": ["Task 1", "Task 2"]
    }
  ],
  "education_list": [
    {
      "institution": "University Name",
      "degree": "Major",
      "location": "City, State",
      "duration": "Year range"
    }
  ]
}
```

---

## 🛠️ Installation

### 1. Clone the Repository
Open your terminal and run:
```bash
git clone https://github.com/harish426/resume_maintainer.git
cd resume_maintainer/frontend
```

### 2. Install Dependencies
Ensure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 3. Build the Extension
Build the production-ready extension code:
```bash
npm run build
```
This will create a `dist/` folder containing the extension assets.

---

## 🧩 Loading into Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **"Developer mode"** (toggle in the top-right corner).
3. Click **"Load unpacked"**.
4. Select the `resume_tailor/frontend/dist` folder.
5. The **Resume Tailor** icon should now appear in your extensions list. Pin it for easy access!

---

## ⚙️ Configuration

1. Click the extension icon to open the popup.
2. Click the **Settings (⚙️)** icon in the top-right.
3. **API Key**: Enter your Google Gemini API Key. 
   - *Get one for free at [Google AI Studio](https://aistudio.google.com/).*
4. Click **Save Settings**. (Your key is stored securely in your browser's local storage).

---

## 📖 How to Use

1. **Paste Job Description**: Copy the JD of the role you're applying for into the main text area.
2. **Set Intent**:
   - Type "Tailor" to optimize your resume.
   - Type "Write cover letter" for a customized letter.
   - Ask a question like "Why am I a good fit?" to generate interview answers.
3. **Enter Details**: Provide the **Company Name** and **Position Name** to automate file organization.
4. **Generate**: Click **Generate with Gemini**.
5. **Export**:
   - **Download**: Quick export with your name (e.g., `harish_resume.docx`).
   - **Save All**: Creates an organized folder structure in your Downloads containing both the **Resume** and the **JD**.

---

## 🌟 Why this is useful?
- **Beats the ATS**: Most resumes fail because they lack the specific technical keywords found in the JD. This tool injects those keywords naturally.
- **Privacy First**: Unlike web-based resume builders, your data never leaves your browser (except to the Gemini API via encrypted request). 
- **Productivity**: Reduces cover letter and tailoring time from 30 minutes to **30 seconds**.
- **Organization**: No more messy downloads. Every application is timestamped and filed by company name automatically.

---

*Built with ❤️ for AI Engineers and Developers.*
