import LandingPage from "@/components/landing"
import { Navigation } from "@/components/navigation";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import {
  EXPERIMENT_HEADER,
  parseExperimentAssignments,
} from "@/lib/experiments";

export const metadata = { title: "Reach the Right Recruiters with Personalized AI Outreach" };

export default async function Home() {
  const requestHeaders = await headers();
  const experiments = parseExperimentAssignments(requestHeaders.get(EXPERIMENT_HEADER));
  const authResponse = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/user`, {
    cache: "no-store",
    headers: { cookie: (await cookies()).toString() },
  }).catch(() => null);
  const authenticated = Boolean(authResponse?.ok);

  return <>
  <Navigation initialAuthenticated={authenticated} />
  <LandingPage experiments={experiments} />
  </>
}
