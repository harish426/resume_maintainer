import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";
import { ResumeData } from "../types/resume";

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  }

  async analyzeJD(jd: string) {
    const prompt = `
        Analyze the following Job Description (JD) and extract:
        1. required_skills: A list of specific technical skills, tools, and technologies.
        2. expected_tasks: Key responsibilities or tasks the candidate will perform.
        3. key_role_attributes: Important qualities or specific focus areas of the role (e.g., "high-availability", "real-time").

        JD:
        ${jd}

        Return ONLY a JSON object with the keys above.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      if (text.startsWith("```")) {
        text = text.replace(/```json\n?|\n?```/g, "").trim();
      }
      return JSON.parse(text);
    } catch (error) {
      console.error("Error analyzing JD:", error);
      return { required_skills: [], expected_tasks: [], key_role_attributes: [] };
    }
  }

  async tailorExperience(job: any, jdRules: any, progressionIdx: number) {
    let progressionInstr = "";
    if (progressionIdx === 1) {
      progressionInstr = "HIGHLIGHT that you learned and mastered key skills REQUIRED by the JD here. Show growth and application of advanced concepts.";
    } else if (progressionIdx === 3) {
      progressionInstr = "FOCUS on foundational skills learned here. KEEP the complexity at a 'fresher' or 'junior' level. DO NOT over-engineer the achievements; keep them realistic for an entry-level role.";
    }

    const currentResps = Array.isArray(job.responsibilities) ? job.responsibilities : [];

    const prompt = `
            You are an ATS keyword specialist. Your ONLY job is to make MINIMAL, SURGICAL edits to the 
            candidate's existing bullet points so they match JD requirements — nothing more.

            === JD REQUIREMENTS ===
            Required Skills:   ${JSON.stringify(jdRules.required_skills)}
            Expected Tasks:    ${JSON.stringify(jdRules.expected_tasks)}
            Key Attributes:    ${JSON.stringify(jdRules.key_role_attributes)}

            === CANDIDATE'S EXISTING BULLETS (treat these as the source of truth) ===
            ${JSON.stringify(currentResps)}

            Role Progression Note: ${progressionInstr}

            === STRICT EDITING RULES ===

            RULE 1 — EDIT OR REFRAME EVERY BULLET FOR JD FIT:
            For each bullet, decide which of the two paths applies:

            PATH A — GOOD FIT (bullet already relates to a JD requirement):
              Preserve the core action and context. Make surgical keyword swaps or light edits
              to align wording with JD terminology. Keep the same approximate length (±5 words).

            PATH B — POOR FIT (bullet has little or no connection to any JD requirement):
              Do NOT leave it unchanged. Instead, REFRAME it:
              • Keep the candidate's actual underlying activity as a factual anchor (do not fabricate).
              • Reorient the sentence so it emphasises the aspect of that activity most relevant to the JD.
              • You may restructure the sentence, change the opening verb, and shift emphasis —
                but every claim must still be grounded in what the candidate actually did.
              • Example: original "assisted with internal documentation" + JD focuses on data workflows
                → reframe as "structured internal documentation to support data reporting workflows".

            RULE 2 — WORD COUNT GUIDANCE:
            Target ±8 words of the input bullet's word count. Reframed bullets (Path B) may use
            the full range; edited bullets (Path A) should stay tighter (±5 words).

            RULE 3 — KEYWORD INJECTION:
            - Use exact JD terminology wherever possible — do not paraphrase skill names.
            - If Tool A (candidate) and Tool B (JD) are the same category, write "Tool B (via Tool A)".
            - Prioritise injecting skills that are missing from other bullets to maximise JD coverage.
            - Never force a keyword into a bullet where it makes no logical sense.

            RULE 4 — TOOL REMAPPING:
            If candidate used Tool A and JD asks for Tool B (same category), write "Tool B (via Tool A)".
            This is the only acceptable expansion — it adds ≤4 words.

            RULE 5 — SOFT SKILLS:
            If the original bullet already implies a soft skill (e.g., "coordinated with team"), keep that 
            language. Do NOT strip soft skill context when inserting technical keywords.
            Do NOT add soft skill sentences that weren't there — that increases word count.

            RULE 6 — NO FABRICATION:
            Do not add metrics, outcomes, or achievements that are not in the original bullet.

            RULE 7 — SAME BULLET COUNT:
            Output exactly the same number of bullets as input. No merging, no splitting.

            RULE 8 — HUMAN TONE:
            Avoid AI giveaway phrases: "leveraged", "spearheaded", "utilized", "synergized", "streamlined".
            Use plain action verbs the candidate already used.

            OUTPUT: A JSON array of strings — one string per bullet, in the same order as input.
            No markdown fences, no commentary, no explanation. Raw JSON only.
            `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith("```")) {
        text = text.replace(/```json\n?|\n?```/g, "").trim();
      }
      return JSON.parse(text);
    } catch (error) {
      console.error("Error tailoring experience:", error);
      return job.responsibilities;
    }
  }

  async tailorSkills(currentSkills: any, jdSkills: string[]) {
    const prompt = `
        Merge the following "JD Required Skills" into the "Current Skills" dictionary.
        
        Current Skills:
        ${JSON.stringify(currentSkills, null, 2)}
        
        JD Required Skills:
        ${JSON.stringify(jdSkills, null, 2)}
        
        Instructions:
        - Analyze the "JD Required Skills".
        - **STRICTLY ONLY** add specific tools and software names (e.g., "Figma", "React", "PostgreSQL").
        - **DO NOT** add descriptions of work done, activities, or process-oriented skills like "Building applications", "Product design", "UI/UX design", "Rapid prototyping", or "Project management".
        - Place new tools/software into the most appropriate existing category and don't repeat the same skill in multiple categories.
        - Avoid duplicates.
        - Maintain previous skills; do not remove any existing data.
        - Output ONLY the updated JSON dictionary.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith("```")) {
        text = text.replace(/```json\n?|\n?```/g, "").trim();
      }
      return JSON.parse(text);
    } catch (error) {
      console.error("Error tailoring skills:", error);
      return currentSkills;
    }
  }

  async generateCoverLetter(resumeData: ResumeData, jd: string) {
    const name = resumeData.personal_info.name;
    const prompt = `
        You are an expert career coach. Write a professional, compelling cover letter for the candidate below.

        Candidate Name: ${name}

        Full Resume (read ALL sections before writing):
        ${JSON.stringify(resumeData, null, 2)}

        Job Description (JD):
        ${jd}

        STEP 1 — RELEVANCE SCAN (do this silently before writing):
        - Read every entry in professional_experience, projects, and education.
        - Identify the 2-3 experiences or projects that best match what the JD is asking for.
        - Consider ALL entries equally — do NOT default to the most recent role just because it is first.

        STEP 2 — WRITE THE COVER LETTER using the relevant entries you found:
        1. Open with "Dear Hiring Manager,"
        2. First paragraph: Introduce yourself and state why you are excited about this specific role, connecting it to the most relevant experience or project you found.
        3. Second paragraph: Highlight 2-3 concrete examples from the resume (could be thesis, a project, or a past job) that directly address the JD's requirements. Use natural language describing WHAT you built/researched and HOW it relates. Do NOT invent or add any metrics, percentages, or numbers unless they are explicitly written in the resume data above.
        4. Third paragraph: Show understanding of the company's goals and how your skills will add real value.
        5. Close professionally: "Sincerely, ${name}"

        RULES:
        - Do NOT include phone numbers, email addresses, or URLs in the letter body.
        - Do NOT fabricate any metric, percentage, or improvement figure not already in the resume.
        - Do NOT focus exclusively on the most recent job. Select the experiences and projects that best fit the JD.
        - Length: 3-4 paragraphs, concise and specific.
        - Tone: Confident, professional, enthusiastic but grounded in real experience.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      return (await result.response).text().trim();
    } catch (error) {
      return "Error generating cover letter.";
    }
  }

  async answerQuestion(resumeData: ResumeData, jd: string, question: string) {
    const prompt = `
        You are a career coach helping a candidate answer an interview question.

        Interview Question: "${question}"

        Full Resume (read ALL sections carefully):
        ${JSON.stringify(resumeData, null, 2)}

        Job Description context:
        ${jd}

        STEP 1 — RELEVANCE SCAN (do this silently, do NOT include it in the output):
        - Read every entry in professional_experience AND projects AND education.
        - Map the question's theme to the most relevant experience:
            * Questions about personal challenge, difficult problem, or perseverance  → look at thesis/research projects first.
            * Questions about teamwork or collaboration → look at group projects or internships.
            * Questions about technical skills or pipelines → pick the experience that actually used those skills.
            * Questions about why this company / motivation → draw on education goals and most relevant projects.
        - Choose the SINGLE most relevant story. Do NOT always default to the most recent job.

        STEP 2 — WRITE THE ANSWER using only the experience you selected:
        1. Briefly state WHAT the situation/project was (1-2 sentences, name it specifically).
        2. Explain the challenge or task you faced.
        3. Describe what YOU did to address it.
        4. State the outcome in natural language — describe what was achieved, learned, or delivered.
        5. Connect it briefly to what this role needs.

        RULES:
        - Maximum 150 words.
        - Do NOTPool invent or fabricate any percentage, metric, or improvement figure unless it appears verbatim in the resume data above.
        - Do NOT default to the most recent role if another experience is more relevant to the question.
        - Write in first person, professional and confident tone.
        - No bullet points — write in flowing prose.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      return (await result.response).text().trim();
    } catch (error) {
      return "Error answering question.";
    }
  }

  async processResumeTailoring(resumeData: ResumeData, jd: string) {
    const jdRules = await this.analyzeJD(jd);
    const tailoredData = JSON.parse(JSON.stringify(resumeData || {})); // Deep copy with fallback

    // Ensure basic structure exists to avoid .length errors
    tailoredData.technologies = tailoredData.technologies || {};
    tailoredData.professional_experience = tailoredData.professional_experience || [];
    tailoredData.projects = tailoredData.projects || [];

    // Tailor Skills
    tailoredData.technologies = await this.tailorSkills(tailoredData.technologies, jdRules.required_skills);

    // Tailor Experience (First and third as per Python logic)
    for (let i = 0; i < tailoredData.professional_experience.length; i++) {
      const job = tailoredData.professional_experience[i];
      const newResps = await this.tailorExperience(job, jdRules, i + 1);
      tailoredData.professional_experience[i].responsibilities = newResps;
    }

    // Tailor Projects
    for (let i = 0; i < tailoredData.projects.length; i++) {
      const proj = tailoredData.projects[i];
      const newResps = await this.tailorExperience({ responsibilities: proj.description || [] }, jdRules, 0);
      tailoredData.projects[i].description = newResps;
    }

    return tailoredData;
  }
}
