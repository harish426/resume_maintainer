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
        4. domain_keywords: A list of domain-specific and soft terminology from the JD that are NOT hard technical tools but should appear in resume bullets for ATS alignment. Examples: "underwriting", "marketing", "scalability", "automation", "research", "workflow", "CRM", "AI", "machine learning", "internal tools", "compliance", "data-driven", "real-time", "analytics", "optimization". Extract ALL such terms from the JD.
        5. soft_skills: A list of interpersonal/soft skills mentioned or implied in the JD. Examples: "communication", "collaboration", "leadership", "teamwork", "problem-solving", "stakeholder management", "mentoring", "cross-functional coordination", "time management", "adaptability", "presentation skills", "client-facing", "documentation". Extract ALL such soft skills from the JD.

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
      return { required_skills: [], expected_tasks: [], key_role_attributes: [], domain_keywords: [], soft_skills: [] };
    }
  }

  async tailorExperience(job: any, jdRules: any, progressionIdx: number, assignedSkills: string[] = []) {
    let progressionInstr = "";
    if (progressionIdx === 1) {
      progressionInstr = "HIGHLIGHT that you learned and mastered key skills REQUIRED by the JD here. Show growth and application of advanced concepts.";
    } else if (progressionIdx === 3) {
      progressionInstr = "FOCUS on foundational skills learned here. KEEP the complexity at a 'fresher' or 'junior' level. DO NOT over-engineer the achievements; keep them realistic for an entry-level role.";
    }

    const currentResps = Array.isArray(job.responsibilities) ? job.responsibilities : [];
    const duration = job.duration || "";

    const prompt = `
            You are an ATS keyword specialist. Your job is to make targeted edits to the
            candidate's existing bullet points so they cover the ASSIGNED SKILLS for this experience.

            === EXPERIENCE TIME PERIOD ===
            ${duration}

            === JD REQUIREMENTS (for context only) ===
            Required Skills:   ${JSON.stringify(jdRules.required_skills)}
            Expected Tasks:    ${JSON.stringify(jdRules.expected_tasks)}
            Key Attributes:    ${JSON.stringify(jdRules.key_role_attributes)}
            Domain Keywords:   ${JSON.stringify(jdRules.domain_keywords || [])}
            Soft Skills:       ${JSON.stringify(jdRules.soft_skills || [])}

            === SKILLS ASSIGNED TO THIS EXPERIENCE (you MUST cover these) ===
            ${JSON.stringify(assignedSkills)}

            === CANDIDATE'S EXISTING BULLETS (source of truth) ===
            ${JSON.stringify(currentResps)}

            Role Progression Note: ${progressionInstr}

            === STRICT EDITING RULES ===

            RULE 1 — THREE PATHS FOR EACH BULLET:
            Classify each bullet into one of three paths:

            PATH A — STRONG BULLET (bullet is impressive, well-written, or already JD-relevant):
              KEEP IT MOSTLY THE SAME. Only make small keyword tweaks (±3 words) to align
              terminology. Do NOT rewrite the sentence structure.

            PATH B — EQUIVALENT TOOL SWAP (bullet uses a tool that has a direct JD equivalent):
              Do a simple 1:1 tool name replacement. For example:
              • "AWS Lambda" → "Azure Functions" (if JD asks for Azure)
              • "S3" → "Blob Storage"
              • "FAISS" → "Pinecone"
              Do NOT rewrite the surrounding sentence. Just swap the tool name.
              Only swap tools that are genuine functional equivalents in the same category.

            PATH C — WEAK/IRRELEVANT BULLET (bullet has no connection to any assigned skill):
              REPLACE the entire bullet with a new, well-structured bullet that describes
              how the candidate used one of the ASSIGNED SKILLS in this project's context.
              • The new bullet MUST match the writing style, tone, and approximate length of
                the other bullets in this experience.
              • Ground it in the project domain (e.g., if the project was about recommendation
                engines, write the new bullet in that context).
              • Do NOT fabricate metrics or outcomes — keep it realistic.

            RULE 2 — ASSIGNED SKILLS ONLY:
            You must ONLY integrate skills from the "SKILLS ASSIGNED TO THIS EXPERIENCE" list.
            Do NOT mention or inject any other JD skills — they are handled by other experiences.

            RULE 3 — PRESERVE STRONG BULLETS:
            Most bullets should go through Path A. Only use Path C for bullets that are clearly
            the weakest or least relevant to the JD. Prefer keeping the candidate's original
            writing wherever possible.

            RULE 4 — WORD COUNT:
            Path A: ±3 words of original. Path B: same length. Path C: match average bullet length.

            RULE 5 — NO FABRICATION:
            Do not invent metrics, percentages, or outcomes not in the original bullet.
            For Path C replacement bullets, describe realistic work without fake numbers.

            RULE 6 — SAME BULLET COUNT:
            Output exactly the same number of bullets as input. No merging, no splitting.

            RULE 7 — HUMAN TONE:
            Avoid AI giveaway phrases: "leveraged", "spearheaded", "utilized", "synergized".
            Use plain, professional action verbs.

            RULE 8 — DOMAIN KEYWORD SPRINKLING:
            The "Domain Keywords" list contains soft/domain terms from the JD (e.g., automation,
            scalability, research, CRM, AI, workflow, marketing, underwriting, etc.).
            These are NOT hard tools — they are contextual terms that boost ATS matching.
            - Naturally weave these keywords into existing bullet phrasing wherever they fit.
            - Do NOT force them — only include where the bullet's context genuinely relates.
            - Prefer adding them as adjectives, context phrases, or brief clauses.
            - Example: "Built data pipelines" + domain keyword "automation" → "Built automated data pipelines"
            - Example: "Tracked model performance" + domain keyword "research" → "Conducted research on model performance tracking"
            - Spread them across bullets — don't pack all domain keywords into one bullet.

            RULE 9 — SOFT SKILL INTEGRATION:
            The "Soft Skills" list contains interpersonal skills from the JD (e.g., communication,
            collaboration, leadership, teamwork, stakeholder management, mentoring, etc.).
            - Naturally append soft skill demonstrations to bullets where the context genuinely
              supports it. Add them as brief trailing phrases or clauses at the end of bullet points.
            - Examples:
              • "Deployed microservices on GKE" + soft skill "collaboration"
                → "Deployed microservices on GKE through close collaboration with DevOps and backend teams"
              • "Architected a scalable pipeline" + soft skill "communication"
                → "Architected a scalable pipeline, communicating design decisions to cross-functional stakeholders"
              • "Reduced API latency by 30%" + soft skill "mentoring"
                → "Reduced API latency by 30% while mentoring junior engineers on performance best practices"
            - Do NOT create standalone soft skill bullets. Always attach them to existing technical work.
            - Spread across multiple bullets — do not add soft skills to every bullet, pick 2-3
              bullets where they fit most naturally.
            - Keep the additions brief (5-12 words max per soft skill clause).

            RULE 10 — TEMPORAL CONSISTENCY:
            The experience time period is shown above. Do NOT introduce any tool, framework,
            or technology that did not exist or was not publicly available during that time period.
            Use your knowledge of when tools were released:
            - LangChain: released late 2022, mainstream 2023+
            - LangGraph: released 2024+
            - GPT-4: released March 2023
            - ChatGPT: released November 2022
            - AWS Bedrock: GA September 2023
            - Pinecone: available from 2021+
            - FAISS: available from 2017+
            - Docker/Kubernetes: available well before 2020
            If an assigned skill did not exist during this experience's time period, SKIP it entirely.
            Do NOT mention it in any bullet. It is better to leave a bullet unchanged than to
            create an anachronism.

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

  /**
   * Pre-distributes JD skills across experiences so each skill appears in exactly one experience.
   * Returns a map: { experienceIndex: ["skill1", "skill2", ...] }
   */
  async assignSkillsToExperiences(experiences: any[], requiredSkills: string[]): Promise<Record<number, string[]>> {
    // Build a summary of each experience for the AI to reason about
    const experienceSummaries = experiences.map((job, i) => ({
      index: i,
      role: job.role || "",
      client: job.client || "",
      duration: job.duration || "",
      bullets: Array.isArray(job.responsibilities) ? job.responsibilities : []
    }));

    const prompt = `
        You are an expert resume strategist. Your task is to DISTRIBUTE the JD-required skills
        across the candidate's work experiences so that:
        - Each skill appears in EXACTLY ONE experience (no repetition)
        - Skills are assigned to the experience where they fit most naturally
        - Skills are distributed as EQUALLY as possible across experiences
        - If a skill doesn't fit any experience at all, exclude it

        === CANDIDATE'S EXPERIENCES ===
        ${JSON.stringify(experienceSummaries, null, 2)}

        === JD REQUIRED SKILLS TO DISTRIBUTE ===
        ${JSON.stringify(requiredSkills)}

        === RULES ===
        1. Read each experience's bullets carefully to understand what domain and tools it involves.
        2. Assign each skill to the ONE experience where it fits best based on the work described.
        3. If multiple experiences could host a skill, prefer the one with fewer assigned skills
           (to keep distribution even).
        4. If a skill is already explicitly mentioned in an experience's bullets, assign it there
           (it just needs minor tweaking, not a full rewrite).
        5. Skills that are completely unrelated to any experience should be excluded.
        6. **TEMPORAL CHECK**: Each experience has a "duration" field. Do NOT assign a tool/skill
           to an experience if that tool did not exist during the experience's time period.
           For example, LangChain (released late 2022) should NOT be assigned to a role that
           ended before 2023. Use your knowledge of tool release dates. When in doubt, assign
           the skill to a more recent experience instead.

        === OUTPUT FORMAT ===
        Return ONLY a JSON object where keys are experience indices (as strings) and values are
        arrays of skill names assigned to that experience.
        Example: {"0": ["Kafka", "Docker"], "1": [], "2": ["Dialogflow", "PostgreSQL"]}

        No markdown fences, no commentary. Raw JSON only.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith("```")) {
        text = text.replace(/```json\n?|\n?```/g, "").trim();
      }
      const parsed = JSON.parse(text);

      // Normalize: ensure every experience index has an entry
      const skillMap: Record<number, string[]> = {};
      for (let i = 0; i < experiences.length; i++) {
        skillMap[i] = parsed[String(i)] || [];
      }
      return skillMap;
    } catch (error) {
      console.error("Error assigning skills to experiences:", error);
      // Fallback: no assigned skills, tailoring proceeds without skill constraints
      const fallback: Record<number, string[]> = {};
      for (let i = 0; i < experiences.length; i++) {
        fallback[i] = [];
      }
      return fallback;
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

    // Phase 1: Pre-distribute JD skills across experiences (no repetition)
    const skillMap = await this.assignSkillsToExperiences(
      tailoredData.professional_experience,
      jdRules.required_skills
    );

    // Phase 2: Tailor each experience with only its assigned skills
    for (let i = 0; i < tailoredData.professional_experience.length; i++) {
      const job = tailoredData.professional_experience[i];
      const assignedSkills = skillMap[i] || [];
      const newResps = await this.tailorExperience(job, jdRules, i + 1, assignedSkills);
      tailoredData.professional_experience[i].responsibilities = newResps;
    }

    // Tailor Projects
    for (let i = 0; i < tailoredData.projects.length; i++) {
      const proj = tailoredData.projects[i];
      const newResps = await this.tailorExperience({ responsibilities: proj.description || [] }, jdRules, 0, []);
      tailoredData.projects[i].description = newResps;
    }

    return tailoredData;
  }
}
