import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";
import { ResumeData } from "../types/resume";

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  }

  /**
   * Uses Gemini to understand the user's natural language input and extract:
   * - intent: tailor | cover_letter | question
   * - directives: specific customization instructions (skills to add, focus areas, etc.)
   * - question: the actual interview question text (if intent is "question")
   */
  async detectIntent(userInput: string): Promise<{
    intent: "tailor" | "cover_letter" | "question";
    directives: string[];
    question: string;
  }> {
    const prompt = `
        You are an intent classifier for a resume assistant tool.
        The user has typed the following instruction:

        "${userInput}"

        Your job is to determine:
        1. **intent** — What does the user want?
           - "tailor" = They EXPLICITLY want to generate/tailor/customize their resume.
             ONLY classify as "tailor" if the user uses EXPLICIT resume generation commands like:
             "generate resume", "tailor resume", "tailor", "generate", "go", "create resume",
             "build resume", "make resume", "update resume", or similar SHORT commands.
             If the user adds skills/directives like "add Python" or "focus on data engineering",
             that is ALSO a tailor intent.
             **IMPORTANT: If the input looks like a question from a job application form,
             interview question, or any question someone is asking the candidate — it is NOT
             a tailor intent. It is a "question" intent.**
           - "cover_letter" = They want a cover letter written. Only if they explicitly mention
             "cover letter".
           - "question" = This is the DEFAULT. Any question, prompt, or text that is NOT an
             explicit resume generation command should be classified as "question".
             This includes:
             * Interview questions ("Tell me about yourself", "Why do you want this role?")
             * Application form questions ("Describe your experience with...")
             * Conversational questions ("Would you like to know about something?")
             * Open-ended prompts ("What interests you about this position?")
             * ANY pasted text that looks like a question from a recruiter or application

        2. **directives** — Extract ANY specific customization instructions as an array of short, clear strings.
           Only relevant when intent is "tailor". Examples:
           - "add Python and AWS skills" → ["Add Python skills", "Add AWS skills"]
           - "make it more relevant to data engineering" → ["Focus on data engineering domain"]
           - "emphasize leadership and cloud experience" → ["Emphasize leadership experience", "Emphasize cloud experience"]
           - "change stream to backend development" → ["Shift focus to backend development"]
           - "add more DevOps related content" → ["Add more DevOps related content"]
           - "generate resume" (no extra instructions) → []
           If there are no extra instructions beyond the basic intent, return an empty array.

        3. **question** — If the intent is "question", extract the actual question text.
           Otherwise, return an empty string.

        Return ONLY a JSON object with keys: "intent", "directives", "question".
        No markdown fences, no commentary. Raw JSON only.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith("```")) {
        text = text.replace(/```json\n?|\n?```/g, "").trim();
      }
      const parsed = JSON.parse(text);
      return {
        intent: parsed.intent || "question",
        directives: Array.isArray(parsed.directives) ? parsed.directives : [],
        question: parsed.question || ""
      };
    } catch (error) {
      console.error("Error detecting intent:", error);
      // Fallback to simple keyword matching — default to "question" unless explicit resume command
      const lower = userInput.toLowerCase().trim();
      let intent: "tailor" | "cover_letter" | "question" = "question";
      const tailorKeywords = ["generate resume", "tailor resume", "tailor", "generate", "go", "create resume", "build resume", "make resume", "update resume"];
      if (tailorKeywords.some(kw => lower === kw || lower.startsWith(kw + " "))) {
        intent = "tailor";
      } else if (lower.includes("cover letter")) {
        intent = "cover_letter";
      }
      return { intent, directives: [], question: intent === "question" ? userInput : "" };
    }
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

  /**
   * Checks whether the JD's domain overlaps with the SLU research experience
   * (data processing, deep learning, computer vision, object detection, etc.).
   * If so, the SLU experience should only get light adjustments, not a full rewrite.
   */
  private isJDAlignedWithResearchDomain(jdRules: any): boolean {
    const researchDomainKeywords = [
      'deep learning', 'computer vision', 'object detection', 'image processing',
      'data processing', 'machine learning', 'neural network', 'cnn', 'yolo',
      'image recognition', 'video analytics', 'tracking', 'perception',
      'autonomous', 'drone', 'uav', 'simulation', 'pytorch', 'tensorflow',
      'convolutional', 'lstm', 'transfer learning', 'feature extraction',
      'model training', 'inference', 'gpu', 'quantization', 'stitching',
      'panoramic', 'spatiotemporal', 'convlstm', 'lora', 'fine-tuning',
      'research', 'aerial', 'surveillance', 'motion imagery'
    ];

    const allJDText = [
      ...(jdRules.required_skills || []),
      ...(jdRules.expected_tasks || []),
      ...(jdRules.key_role_attributes || []),
      ...(jdRules.domain_keywords || [])
    ].join(' ').toLowerCase();

    const matchCount = researchDomainKeywords.filter(kw => allJDText.includes(kw)).length;
    return matchCount >= 2; // At least 2 domain keyword matches to consider it aligned
  }

  /**
   * Checks whether the JD is primarily a software engineering role.
   * Used to inject backend emphasis into the SLU experience when it gets fully tailored.
   */
  private isJDSoftwareEngineering(jdRules: any): boolean {
    const sweKeywords = [
      'software engineer', 'software developer', 'backend', 'back-end',
      'full stack', 'fullstack', 'full-stack', 'web developer', 'api',
      'microservices', 'rest api', 'restful', 'spring boot', 'node.js',
      'fastapi', 'flask', 'django', 'express', 'graphql', 'server-side',
      'software development', 'application development', 'web services',
      'distributed systems', 'system design', 'scalable services'
    ];

    const allJDText = [
      ...(jdRules.required_skills || []),
      ...(jdRules.expected_tasks || []),
      ...(jdRules.key_role_attributes || []),
      ...(jdRules.domain_keywords || [])
    ].join(' ').toLowerCase();

    const matchCount = sweKeywords.filter(kw => allJDText.includes(kw)).length;
    return matchCount >= 2;
  }

  /**
   * Light tailoring for the SLU research experience — only minor keyword adjustments
   * to match JD terminology. Does NOT change the core stream, sentence structure,
   * or research focus. Used when the JD already aligns with the research domain.
   */
  async tailorExperienceLightly(job: any, jdRules: any) {
    const currentResps = Array.isArray(job.responsibilities) ? job.responsibilities : [];
    const duration = job.duration || '';

    const prompt = `
            You are making MINIMAL adjustments to a Graduate Research Assistant's bullet points.
            This experience is about computer vision, deep learning, drone/UAV systems, and
            simulation research at a university. The JD already aligns with this domain.

            === EXPERIENCE TIME PERIOD ===
            ${duration}

            === JD REQUIREMENTS (for reference only) ===
            Required Skills:   ${JSON.stringify(jdRules.required_skills)}
            Expected Tasks:    ${JSON.stringify(jdRules.expected_tasks)}
            Domain Keywords:   ${JSON.stringify(jdRules.domain_keywords || [])}

            === CANDIDATE'S EXISTING BULLETS (these are the PRIMARY source of truth) ===
            ${JSON.stringify(currentResps)}

            === STRICT RULES ===

            1. DO NOT CHANGE THE STREAM: The core focus (computer vision, deep learning,
               drone research, simulation, object tracking, image stitching) MUST stay the same.
               Do NOT rewrite bullets to be about a different domain.

            2. MINOR KEYWORD ALIGNMENT ONLY: You may make small edits (±3 words per bullet)
               to naturally include JD terminology WHERE it genuinely fits. For example:
               - If JD mentions "real-time inference" and a bullet already discusses inference,
                 add "real-time" as an adjective.
               - If JD mentions "edge deployment" and a bullet discusses model optimization,
                 you may briefly reference edge deployment context.

            3. PRESERVE SENTENCE STRUCTURE: Do NOT rearrange, merge, split, or significantly
               rewrite any bullet. The sentence formation must stay intact.

            4. PRESERVE ALL TECHNICAL DETAILS: Keep all specific tools, algorithms, metrics,
               and achievements exactly as written (ReYOLOv8, ConvLSTM, VTEI, LoRA, SIFT,
               SURF, LDH, DroneWIS, Matrix City, CARLA, AirSim, C++/Python, etc.).

            5. SAME BULLET COUNT: Output exactly the same number of bullets.

            6. If NO meaningful keyword alignment is possible for a bullet, return it UNCHANGED.

            OUTPUT: A JSON array of strings — one per bullet, same order. Raw JSON only.
            `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith('```')) {
        text = text.replace(/```json\n?|\n?```/g, '').trim();
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('Error lightly tailoring SLU experience:', error);
      return job.responsibilities;
    }
  }

  async tailorExperience(job: any, jdRules: any, progressionIdx: number, assignedSkills: string[] = [], userDirectives: string[] = []) {
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

            ${userDirectives.length > 0 ? `=== USER CUSTOMIZATION DIRECTIVES (MUST follow these) ===
            The user has given the following specific instructions. You MUST incorporate
            these into your editing decisions. They take priority over default behavior:
            ${userDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n            ')}

            For example:
            - If they say "Add Python skills", ensure Python is mentioned naturally in bullets.
            - If they say "Focus on data engineering", bias your edits toward data pipeline/ETL context.
            - If they say "Emphasize leadership", add leadership-related clauses to strong bullets.
            ` : ''}

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

            RULE 8 — SENTENCE FORMATION QUALITY:
            Every bullet must clearly communicate WHAT was done, HOW it was done, and WHY it
            matters. Each sentence should read as a self-contained accomplishment.
            - BAD: "Worked on data processing tasks using various tools."
            - GOOD: "Built automated data ingestion pipelines using Apache Beam and Airflow,
              processing 2M+ daily records for downstream ML model training."
            - The sentence structure should make the reader understand the ACTUAL work performed,
              not vague descriptions. Be specific about the action, the technology, and the impact.
            - Ensure each bullet tells a clear story: ACTION + TECHNOLOGY/METHOD + CONTEXT/RESULT.

            RULE 9 — DOMAIN KEYWORD SPRINKLING:
            The "Domain Keywords" list contains soft/domain terms from the JD (e.g., automation,
            scalability, research, CRM, AI, workflow, marketing, underwriting, etc.).
            These are NOT hard tools — they are contextual terms that boost ATS matching.
            - Naturally weave these keywords into existing bullet phrasing wherever they fit.
            - Do NOT force them — only include where the bullet's context genuinely relates.
            - Prefer adding them as adjectives, context phrases, or brief clauses.
            - Example: "Built data pipelines" + domain keyword "automation" → "Built automated data pipelines"
            - Spread them across bullets — don't pack all domain keywords into one bullet.

            RULE 10 — SOFT SKILL INTEGRATION:
            The "Soft Skills" list contains interpersonal skills from the JD (e.g., communication,
            collaboration, leadership, teamwork, stakeholder management, mentoring, etc.).
            - Naturally append soft skill demonstrations to bullets where the context genuinely
              supports it. Add them as brief trailing phrases or clauses at the end of bullet points.
            - Examples:
              • "Deployed microservices on GKE" + soft skill "collaboration"
                → "Deployed microservices on GKE through close collaboration with DevOps and backend teams"
              • "Architected a scalable pipeline" + soft skill "communication"
                → "Architected a scalable pipeline, communicating design decisions to cross-functional stakeholders"
            - Do NOT create standalone soft skill bullets. Always attach them to existing technical work.
            - Spread across multiple bullets — pick 2-3 bullets where they fit most naturally.
            - Keep the additions brief (5-12 words max per soft skill clause).

            RULE 11 — TEMPORAL CONSISTENCY:
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
  async assignSkillsToExperiences(experiences: any[], requiredSkills: string[], userDirectives: string[] = []): Promise<Record<number, string[]>> {
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

        ${userDirectives.length > 0 ? `=== USER CUSTOMIZATION DIRECTIVES ===
        The user has given these specific instructions. Consider them when distributing skills:
        ${userDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n        ')}
        If the user mentions specific skills or domains, ensure those skills are prioritized
        and placed in the most impactful (usually most recent) experience.
        ` : ''}

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

  async tailorSkills(currentSkills: any, jdSkills: string[], userDirectives: string[] = []) {
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
        ${userDirectives.length > 0 ? `- USER DIRECTIVES (prioritize these):\n        ${userDirectives.map((d, i) => `  ${i + 1}. ${d}`).join('\n        ')}\n        If the user asks to add specific skills, ensure those skills are added to the appropriate categories even if they are not in the JD Required Skills list.` : ''}
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

  async generateCoverLetter(resumeData: ResumeData, jd: string, userDirectives: string[] = []) {
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
        ${userDirectives.length > 0 ? `
        === USER CUSTOMIZATION DIRECTIVES (MUST follow these) ===
        ${userDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n        ')}
        Incorporate these directives into the cover letter. For example, if they say
        "emphasize leadership", ensure leadership stories are prominently featured.` : ''}
        `;

    try {
      const result = await this.model.generateContent(prompt);
      return (await result.response).text().trim();
    } catch (error) {
      return "Error generating cover letter.";
    }
  }

  async answerQuestion(resumeData: ResumeData, jd: string, question: string, userDirectives: string[] = []) {
    const candidateName = resumeData.personal_info?.name || "the candidate";
    const prompt = `
        You ARE ${candidateName} — a real person responding to a question during a job application
        or conversation with a recruiter. You are NOT an AI assistant or career coach.
        Respond exactly as this person would — naturally, casually-professional, and human.

        Question: "${question}"

        Your resume (your actual background — use ONLY when the question asks about your experience):
        ${JSON.stringify(resumeData, null, 2)}

        Job Description (context for the role you're applying to):
        ${jd}

        === HOW TO RESPOND ===

        STEP 1 — CLASSIFY THE QUESTION TYPE (do this silently):

        TYPE A — CONVERSATIONAL / OPEN-ENDED:
        Questions like: "Would you like to know about something?", "Do you have any questions?",
        "Is there anything else you'd like to share?", "What questions do you have for us?",
        "Would you like to add anything?"
        → Respond like a REAL human candidate would. Ask genuine questions back:
          • "When can I expect to hear back about next steps?"
          • "What does a typical day look like for this role?"
          • "How large is the team I'd be working with?"
          • "What's the tech stack the team is currently using?"
          • "Is there flexibility for remote work?"
          Pick 1-2 natural questions that a real person would ask. Be genuine, curious, and warm.

        TYPE B — EXPERIENCE / SKILLS QUESTION:
        Questions that ask about your background, skills, projects, challenges, achievements.
        → Pull from your resume data. Pick the MOST relevant story (not always the most recent).
          Use STAR format naturally (situation, task, action, result) but in flowing prose.
          Be specific — name the project, the tech, what you actually did.

        TYPE C — MOTIVATION / FIT QUESTION:
        Questions like: "Why do you want this role?", "Why this company?", "What interests you?"
        → Be genuine and enthusiastic. Connect your actual background to what excites you about
          this specific role/company. Don't be generic — reference specifics from the JD.

        TYPE D — LOGISTICS / SIMPLE QUESTIONS:
        Questions like: "Are you available for an interview?", "What is your expected salary?",
        "When can you start?", "Are you authorized to work in...?"
        → Give a straightforward, friendly human answer. Be direct.

        === PERSONA RULES ===
        - Write in FIRST PERSON as ${candidateName}.
        - Sound like a real human texting or emailing a recruiter — not a robot, not an essay.
        - Use natural language: contractions ("I'm", "I've", "I'd"), casual-professional tone.
        - Keep responses concise — most answers should be 50-150 words max.
        - For conversational questions (Type A), keep it brief — 1-3 sentences is fine.
        - Do NOT start every answer with "I" — vary your sentence openings.
        - Do NOT use phrases like "leveraged", "spearheaded", "utilized" — talk like a normal person.
        - Do NOT fabricate any metrics, percentages, or numbers not in your resume.
        - If the question is vague or doesn't need a long answer, keep it short and human.
        - Show personality — it's okay to express genuine excitement, curiosity, or humor.
        ${userDirectives.length > 0 ? `
        === USER CUSTOMIZATION DIRECTIVES (MUST follow these) ===
        ${userDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n        ')}
        Incorporate these directives into your answer.` : ''}
        `;

    try {
      const result = await this.model.generateContent(prompt);
      return (await result.response).text().trim();
    } catch (error) {
      return "Error answering question.";
    }
  }

  async processResumeTailoring(resumeData: ResumeData, jd: string, userDirectives: string[] = []): Promise<{ tailoredData: any; jdRules: any }> {
    const jdRules = await this.analyzeJD(jd);
    const tailoredData = JSON.parse(JSON.stringify(resumeData || {})); // Deep copy with fallback

    // Ensure basic structure exists to avoid .length errors
    tailoredData.technologies = tailoredData.technologies || {};
    tailoredData.professional_experience = tailoredData.professional_experience || [];
    tailoredData.projects = tailoredData.projects || [];

    // Tailor Skills (with user directives)
    tailoredData.technologies = await this.tailorSkills(tailoredData.technologies, jdRules.required_skills, userDirectives);

    // Phase 1: Pre-distribute JD skills across experiences (with user directives)
    const skillMap = await this.assignSkillsToExperiences(
      tailoredData.professional_experience,
      jdRules.required_skills,
      userDirectives
    );

    // Phase 2: Tailor each experience with only its assigned skills (with user directives)
    // SLU experience (index 1): ONLY touch it if JD asks for deep learning / computer vision.
    // Otherwise, leave it completely unchanged.
    const sluIndex = 1; // Saint Louis University Graduate Research Assistant
    const jdAlignsWithSLU = this.isJDAlignedWithResearchDomain(jdRules);

    for (let i = 0; i < tailoredData.professional_experience.length; i++) {
      const job = tailoredData.professional_experience[i];
      const assignedSkills = skillMap[i] || [];

      if (i === sluIndex && jdAlignsWithSLU) {
        // JD asks for DL/CV — apply light keyword adjustments only (preserve the stream)
        console.log('SLU experience: JD requires DL/CV — applying light tailoring');
        const newResps = await this.tailorExperienceLightly(job, jdRules);
        tailoredData.professional_experience[i].responsibilities = newResps;
      } else if (i === sluIndex) {
        // JD is NOT about DL/CV — leave SLU experience completely untouched
        console.log('SLU experience: JD does not require DL/CV — skipping, keeping original');
      } else {
        // First (index 0) and last (index 2) experiences — always tailor normally
        const newResps = await this.tailorExperience(job, jdRules, i + 1, assignedSkills, userDirectives);
        tailoredData.professional_experience[i].responsibilities = newResps;
      }
    }

    // Tailor Projects (with user directives)
    for (let i = 0; i < tailoredData.projects.length; i++) {
      const proj = tailoredData.projects[i];
      const newResps = await this.tailorExperience({ responsibilities: proj.description || [] }, jdRules, 0, [], userDirectives);
      tailoredData.projects[i].description = newResps;
    }

    return { tailoredData, jdRules };
  }

  /**
   * Follow-up tailoring: only re-processes the most recent experience (index 0)
   * with the new user directives. All other experiences, projects, and skills
   * remain unchanged from the previous tailoring pass.
   */
  async processFollowUpTailoring(previousTailoredData: any, jdRules: any, userDirectives: string[]): Promise<{ tailoredData: any; jdRules: any }> {
    const tailoredData = JSON.parse(JSON.stringify(previousTailoredData)); // Deep copy

    // Only re-tailor the most recent experience (index 0) with new directives
    if (tailoredData.professional_experience && tailoredData.professional_experience.length > 0) {
      const job = tailoredData.professional_experience[0];
      const assignedSkills = jdRules.required_skills || [];
      const newResps = await this.tailorExperience(job, jdRules, 1, assignedSkills, userDirectives);
      tailoredData.professional_experience[0].responsibilities = newResps;
    }

    return { tailoredData, jdRules };
  }
}
