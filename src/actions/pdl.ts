"use server";

import { PDLJSClient } from "@/lib/pdlClient";

export async function enrichProfile(profileUrl: string) {
  try {
    const params = {
      profile: profileUrl,
      titlecase: true
    };

    const response = await PDLJSClient.person.enrichment(params);
    return response.data;
  } catch (error) {
    console.error("Errore enrichProfile:", error);
    throw new Error("Enrichment failed");
  }
}
