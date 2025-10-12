import Image from "next/image";
import LandingPage from "@/components/landing"
import { Navigation } from "@/components/navigation";

export default function Home() {
  return <>
  <Navigation />
  <LandingPage />
  </>
}
