import Image from "next/image";
import LandingPage from "@/components/landing"
import { Navigation } from "@/components/navigation";

export const metadata = { title: "Land Your Dream Job with AI" };

export default function Home() {
  return <>
  <Navigation />
  <LandingPage />
  </>
}
