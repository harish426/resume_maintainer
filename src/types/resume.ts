export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface TechnologyCategory {
  [category: string]: string[];
}

export interface Experience {
  client: string;
  location: string;
  role: string;
  duration: string;
  responsibilities: string[];
}

export interface Project {
  name: string;
  url?: string;
  description: string[];
}

export interface Education {
  institution: string;
  degree: string;
  location: string;
  duration: string;
}

export interface ResumeData {
  personal_info: PersonalInfo;
  technologies: TechnologyCategory;
  professional_experience: Experience[];
  projects: Project[];
  education_list: Education[];
}
