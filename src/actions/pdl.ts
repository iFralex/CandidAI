"use server";

import { ProfileSummary } from "@/components/onboarding";
import { PDLJSClient } from "@/lib/pdlClient";
import mammoth from "mammoth";

export async function enrichProfilePDL(profileUrl: string) {
  try {
    const params = {
      profile: profileUrl,
      titlecase: true
    };

    const response = await PDLJSClient.person.enrichment(params);
    response.data.skills = await translateSkillsToEnglish(response.data.skills || [])
    return response.data;
  } catch (error) {
    console.error("Errore enrichProfile:", error);
    throw new Error("Enrichment failed");
  }
}

export async function translateSkillsToEnglish(skills: string[]): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

  // Traduzione in parallelo di tutte le skills
  const translations = await Promise.all(
    skills.map(async (skill) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: skill,
          target: "en"
        }),
      });

      if (!res.ok) {
        console.error(`Errore nella traduzione di "${skill}", status: ${res.status}, error: ${await res.text()}`);
        return skill; // fallback alla stringa originale
      }

      const data = await res.json();
      return data.data.translations[0].translatedText as string;
    })
  );

  return translations;
}

export async function enrichProfileAI(profileSummary: ProfileSummary | null, formData: FormData): Promise<ProfileSummary> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  // Build website lookup maps from PDL data.
  // These are used after Gemini merge to ensure PDL websites are never lost,
  // and to give the client enough info to fetch logos via Brandfetch.
  const companyWebsiteMap = new Map<string, string>(); // company name -> website
  const schoolWebsiteMap = new Map<string, string>();  // school name -> website

  if (profileSummary) {
    for (const exp of profileSummary.experience) {
      if (exp.company?.name && (exp.company as any).website) {
        companyWebsiteMap.set(exp.company.name, (exp.company as any).website);
      }
    }
    for (const edu of profileSummary.education) {
      if (edu.school?.name && (edu.school as any).website) {
        schoolWebsiteMap.set(edu.school.name, (edu.school as any).website);
      }
    }
  }

  const cv = formData.get("cv") as File;
  const cvText = await getTextFromCV(cv);

  // Strip logos before sending to Gemini — they are binary metadata, not text
  const pdlForPrompt = profileSummary
    ? {
        ...profileSummary,
        experience: profileSummary.experience.map(({ logo, ...rest }: any) => rest),
        education: profileSummary.education.map(({ logo, ...rest }: any) => rest),
      }
    : null;

  const existingData = pdlForPrompt
    ? JSON.stringify(pdlForPrompt, null, 2)
    : "No existing data available.";

  const prompt = `You are a professional profile enrichment assistant.

You are given:
1. EXISTING PROFILE DATA from LinkedIn/PDL (authoritative source for names and metadata):
${existingData}

2. CV TEXT (primary source for additional entries, projects, certifications, and dates):
${cvText}

RULES — follow strictly:
- CANONICAL NAMES: When a company or institution appears in both sources, ALWAYS use the exact name from the PDL data, even if the CV uses an abbreviation or different language (e.g. if PDL has "Politecnico di Milano" and CV has "Polimi" or "Polytechnic of Milan", always output "Politecnico di Milano"). Apply this canonical name to ALL entries that refer to that institution, including new entries found only in the CV.
- CANONICAL WEBSITES: When an institution has a "website" in the PDL data, copy that website into ALL entries for that same institution, including new entries found only in the CV.
- MERGE ENTRIES: Merge two entries into one ONLY when they clearly represent the exact same experience or degree — i.e. same job role/title at the same company in the same period, or same degree level at the same institution in the same period. Enrich the merged entry with details from both sources.
- KEEP SEPARATE ENTRIES: A person can have multiple distinct entries at the same institution or company. Keep them as separate entries in all these cases:
  - Education: different degree levels at the same university (e.g. Bachelor's + Master's at Politecnico di Milano) → 2 entries.
  - Education: same degree level but different time periods at the same university → 2 entries.
  - Experience: different job titles at the same company, even if consecutive → 2 entries.
  Never collapse distinct entries into one just because they share the same institution or company name.
- DOUBLE DEGREE: A double degree / double diploma is a single postgraduate programme delivered jointly by two universities. It MUST produce EXACTLY TWO separate education entries in the output — one per university — with identical degree, majors, start_date, end_date, and description. Apply canonical names and websites from PDL to each university independently.
  EXAMPLE — if the CV says "MSc Double Degree, Computer Science, 2022–2024, Politecnico di Milano & KTH Royal Institute of Technology", output these two entries (plus any Bachelor entry that already existed):
  { "school": { "name": "Politecnico di Milano" }, "degree": "Master of Science", "majors": ["Computer Science"], "start_date": "2022", "end_date": "2024", "description": "Double degree programme in partnership with KTH Royal Institute of Technology." }
  { "school": { "name": "KTH Royal Institute of Technology" }, "degree": "Master of Science", "majors": ["Computer Science"], "start_date": "2022", "end_date": "2024", "description": "Double degree programme in partnership with Politecnico di Milano." }
  Do NOT merge these two entries. Do NOT attach the Master's entry to any existing Bachelor's entry at Politecnico di Milano.
- NEW ENTRIES: Add entries found in the CV that have no equivalent in PDL (applying canonical names and websites where the institution or company is already known from PDL).
- SKILLS: Combine from both sources, deduplicate, translate all to English.
- PROJECTS & CERTIFICATIONS: Extract from CV text.
- LOCATION: Prefer PDL location.
- NAME & TITLE: Prefer PDL values when available.

Return ONLY a valid JSON object matching EXACTLY this TypeScript interface — no markdown, no explanation:

interface Experience {
  title?: { name: string };
  company?: { name: string; website?: string; location?: { name: string } };
  start_date?: string;
  end_date?: string;
  description?: string; // brief summary of responsibilities and achievements
}
interface Education {
  school?: { name: string; website?: string };
  degree: string;
  majors?: string[];
  start_date?: string;
  end_date?: string;
  description?: string; // notable activities, thesis, honours, or context
}
interface Project {
  name: string;
  description: string;
  technologies: string[];
  start_date?: string;
  end_date?: string;
}
interface Certification {
  name: string;
  autority: string;
  issue_date: string;
  expired: boolean;
}
interface ProfileSummary {
  name: string;
  title: string;
  location?: { country: string; continent: string };
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let merged: ProfileSummary;
  try {
    merged = JSON.parse(json);
  } catch {
    console.error("Gemini returned invalid JSON:", json);
    return profileSummary ?? {
      name: "", title: "", skills: [], experience: [], education: [], projects: [], certifications: []
    };
  }

  // Re-attach PDL websites when Gemini dropped them (without fetching logos — that stays client-side)
  merged.experience = merged.experience.map((exp: any) => {
    const website = exp.company?.website ?? (exp.company?.name ? companyWebsiteMap.get(exp.company.name) : undefined);
    if (!website || exp.company?.website === website) return exp;
    return { ...exp, company: { ...exp.company, website } };
  });

  merged.education = merged.education.map((edu: any) => {
    const website = edu.school?.website ?? (edu.school?.name ? schoolWebsiteMap.get(edu.school.name) : undefined);
    if (!website || edu.school?.website === website) return edu;
    return { ...edu, school: { ...edu.school, website } };
  });

  return merged;
}

async function getTextFromCV(cv: File) {
  async function parsePDF(buffer: Buffer) {
    // Import diretto alla lib per evitare il bug di pdf-parse v1 che carica un file di test all'avvio
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const data = await pdfParse(buffer);
    return data.text as string;
  }

  async function parseDocx(buffer: Buffer) {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value; // HTML strutturato
  }

  function parseTxt(buffer: Buffer) {
    return buffer.toString("utf-8");
  }

  function structureText(raw: string) {
    function isHeading(line: string) {
      return /^[A-Z\s]{3,}$/.test(line.trim());
    }

    function isBullet(line: string) {
      return /^[-•*]/.test(line.trim());
    }

    const lines = raw.split("\n");

    let result = "";

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (isHeading(line)) {
        result += `\n## ${line}\n`;
      } else if (isBullet(line)) {
        result += `${line}\n`;
      } else {
        result += `${line}\n`;
      }
    }

    return result;
  }

  const buffer = Buffer.from(await cv.arrayBuffer());

  let text = "";

  if (cv.type === "application/pdf") {
    text = await parsePDF(buffer);
  } else if (cv.type.includes("word")) {
    text = await parseDocx(buffer);
  } else if (cv.type === "text/plain") {
    text = parseTxt(buffer);
  }

  const structured = structureText(text);

  return structured
}