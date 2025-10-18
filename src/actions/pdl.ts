"use server";

import { PDLJSClient } from "@/lib/pdlClient";

export async function enrichProfile(profileUrl: string) {
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