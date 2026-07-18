import LandingPage from "@/components/landing"
import { Navigation } from "@/components/navigation";
import { headers } from "next/headers";
import {
  EXPERIMENT_HEADER,
  parseExperimentAssignments,
} from "@/lib/experiments";

export const metadata = { title: "Land Your Dream Job with AI" };

export default async function Home() {
  const requestHeaders = await headers();
  const experiments = parseExperimentAssignments(requestHeaders.get(EXPERIMENT_HEADER));

  return <>
  <Navigation />
  <LandingPage experiments={experiments} />
  </>
}
