"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { track } from "@/lib/analytics";
import {
    Download,
    Mail,
    Zap,
    Shield,
    CheckCircle,
    Send,
    Inbox,
    Key,
    ArrowRight,
    Sparkles,
    Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MAC_URL = "https://firebasestorage.googleapis.com/v0/b/candidai-1bda0.firebasestorage.app/o/Desktop-downloads%2FCandidAI.dmg?alt=media&token=2ff8a5f6-ca36-4f8f-9ef5-5957ae300927";
const WIN_URL = "https://firebasestorage.googleapis.com/v0/b/candidai-1bda0.firebasestorage.app/o/Desktop-downloads%2FCandidAI-Setup.exe?alt=media&token=05a93475-8eee-447b-92b2-88b83b9647fe";

const AppleIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.1 190.5-49.1 30.8 0 133.3 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
);

const WindowsIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 88 88" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349-.011 41.34-47.318-6.678-.066-34.739z"/>
    </svg>
);

type OS = "mac" | "win" | null;

function useDetectedOS(): OS {
    const [os, setOs] = useState<OS>(null);
    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes("mac")) setOs("mac");
        else if (ua.includes("win")) setOs("win");
    }, []);
    return os;
}

function DownloadButtons({ size = "lg", hero = false }: { size?: "lg" | "sm"; hero?: boolean }) {
    const os = useDetectedOS();

    const macBtn = (
        <a key="mac" href={MAC_URL} onClick={() => track({ name: "app_download_click", params: { platform: "mac" } })}>
            <Button
                variant="primary"
                size={size}
                className={`flex items-center gap-2 font-semibold shadow-lg shadow-violet-500/20 ${hero ? "px-8 py-4 text-base" : "px-7"}`}
            >
                <AppleIcon className="w-5 h-5" />
                Download for Mac
                {hero && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
        </a>
    );

    const winBtn = (
        <a key="win" href={WIN_URL} onClick={() => track({ name: "app_download_click", params: { platform: "win" } })}>
            <Button
                variant="secondary"
                size={size}
                className={`flex items-center gap-2 font-semibold border border-white/20 bg-white/5 hover:bg-white/10 text-white ${hero ? "px-8 py-4 text-base" : "px-7"}`}
            >
                <WindowsIcon className="w-5 h-5" />
                Download for Windows
            </Button>
        </a>
    );

    // Show the user's platform button first; default to Windows
    const buttons = os === "mac" ? [macBtn, winBtn] : [winBtn, macBtn];
    return <>{buttons}</>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};


const steps = [
    {
        icon: <Download className="w-6 h-6" />,
        title: "Download & Install",
        description:
            "Install the CandidAI desktop app on your Mac or Windows machine in seconds. No configuration needed.",
        color: "from-violet-500 to-purple-600",
    },
    {
        icon: <Key className="w-6 h-6" />,
        title: "Connect your email",
        description:
            "Link your Gmail, Outlook, or Resend account with one click. Your credentials never leave your device.",
        color: "from-purple-500 to-pink-600",
    },
    {
        icon: <Inbox className="w-6 h-6" />,
        title: "Review your emails",
        description:
            "See all the AI-generated job applications ready to send. Edit any email or subject line before sending.",
        color: "from-pink-500 to-rose-600",
    },
    {
        icon: <Send className="w-6 h-6" />,
        title: "Send all in one click",
        description:
            "Hit send and watch your applications go out automatically, with your CV attached to every single one.",
        color: "from-rose-500 to-orange-500",
    },
];

const features = [
    {
        icon: <Mail className="w-5 h-5" />,
        title: "Multi-provider support",
        description: "Works with Gmail, Outlook, and Resend out of the box.",
    },
    {
        icon: <Zap className="w-5 h-5" />,
        title: "One-click bulk send",
        description: "Send dozens of applications simultaneously without lifting a finger.",
    },
    {
        icon: <Shield className="w-5 h-5" />,
        title: "Privacy first",
        description: "Your email credentials are stored locally, never on our servers.",
    },
    {
        icon: <Sparkles className="w-5 h-5" />,
        title: "AI-powered emails",
        description: "Every email is personalised by AI for the specific company and recruiter.",
    },
    {
        icon: <CheckCircle className="w-5 h-5" />,
        title: "Smart CV attachment",
        description: "Automatically attaches your CV to every outgoing application.",
    },
    {
        icon: <Globe className="w-5 h-5" />,
        title: "Real-time sync",
        description: "Sent status syncs instantly back to your CandidAI dashboard.",
    },
];

const ProviderBadge = ({ label, color }: { label: string; color: string }) => (
    <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${color}`}
    >
        {label}
    </span>
);

export default function DownloadPage() {
    useEffect(() => {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
        const detected = ua.includes("mac") ? "mac" : ua.includes("win") ? "win" : "unknown";
        track({ name: "download_page_view", params: { detected_platform: detected } });
    }, []);

    return (
        <div className="relative min-h-screen space-y-24 pb-24">

            {/* ── HERO ── */}
            <section className="relative flex flex-col items-center text-center pt-10 gap-8">
                {/* Glow blobs */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[640px] h-[400px] rounded-full bg-violet-600/20 blur-3xl" />
                    <div className="absolute top-40 left-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-2xl" />
                    <div className="absolute top-40 right-1/4 w-64 h-64 rounded-full bg-pink-500/10 blur-2xl" />
                </div>

                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="relative z-10 flex flex-col items-center gap-4"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300 text-sm font-medium">
                        <Sparkles className="w-3.5 h-3.5" />
                        Desktop App - Free for all plans
                    </span>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white max-w-3xl">
                        Send all your applications{" "}
                        <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                            in one click
                        </span>
                    </h1>

                    <p className="text-gray-400 text-lg max-w-xl">
                        The CandidAI desktop app connects to your email provider and fires off every
                        personalised application, with your CV attached, automatically.
                    </p>
                </motion.div>

                {/* Provider badges */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.1 }}
                    className="relative z-10 flex flex-wrap justify-center gap-2"
                >
                    <ProviderBadge label="Gmail" color="border-red-500/30 text-red-300 bg-red-500/10" />
                    <ProviderBadge label="Outlook" color="border-blue-500/30 text-blue-300 bg-blue-500/10" />
                    <ProviderBadge label="Resend" color="border-violet-500/30 text-violet-300 bg-violet-500/10" />
                </motion.div>

                {/* Download buttons */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.2 }}
                    className="relative z-10 flex flex-col sm:flex-row gap-4 items-center"
                >
                    <DownloadButtons hero />
                </motion.div>

                <motion.p
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.3 }}
                    className="relative z-10 text-gray-500 text-sm"
                >
                    macOS 12+ · Windows 10+ · Free · No credit card required
                </motion.p>

                {/* App window mockup */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.4 }}
                    className="relative z-10 w-full max-w-3xl mt-4"
                >
                    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur overflow-hidden shadow-2xl shadow-black/60">
                        {/* Window chrome */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.04]">
                            <div className="w-3 h-3 rounded-full bg-red-500/70" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                            <div className="w-3 h-3 rounded-full bg-green-500/70" />
                            <span className="ml-3 text-xs text-gray-500 font-mono">CandidAI Desktop</span>
                        </div>

                        {/* Fake app UI */}
                        <div className="p-5 space-y-3">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-white text-sm font-semibold">8 emails ready to send</div>
                                        <div className="text-gray-500 text-xs">Gmail · connected</div>
                                    </div>
                                </div>
                                <div className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5">
                                    <Send className="w-3 h-3" />
                                    Send All
                                </div>
                            </div>

                            {/* Email rows */}
                            {[
                                { company: "Stripe", role: "Software Engineer", status: "pending" },
                                { company: "Linear", role: "Frontend Developer", status: "pending" },
                                { company: "Vercel", role: "Developer Experience", status: "sent" },
                                { company: "Notion", role: "Product Engineer", status: "pending" },
                            ].map((row, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between rounded-xl px-4 py-3 bg-white/[0.04] border border-white/[0.07]"
                                >
                                    <div>
                                        <p className="text-white text-sm font-medium">{row.company}</p>
                                        <p className="text-gray-500 text-xs">{row.role}</p>
                                    </div>
                                    {row.status === "sent" ? (
                                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                                            <CheckCircle className="w-3.5 h-3.5" /> Sent
                                        </span>
                                    ) : (
                                        <span className="text-xs text-violet-300 font-medium px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                                            Pending
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Glow under card */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-violet-600/20 blur-2xl rounded-full" />
                </motion.div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section className="relative z-10 max-w-5xl mx-auto">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                        How it works
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto">
                        From install to inbox in under two minutes.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {steps.map((step, i) => (
                        <motion.div
                            key={i}
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.12 }}
                            className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/20 transition-colors group"
                        >
                            {/* Step number */}
                            <span className="absolute top-4 right-4 text-xs font-mono text-gray-600">
                                0{i + 1}
                            </span>

                            {/* Icon */}
                            <div
                                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg`}
                            >
                                {step.icon}
                            </div>

                            <div>
                                <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                            </div>

                            {/* Connector arrow (except last) */}
                            {i < steps.length - 1 && (
                                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                                    <ArrowRight className="w-5 h-5 text-gray-600" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section className="relative z-10 max-w-5xl mx-auto">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                        Everything you need
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto">
                        Built for job seekers who don't want to waste time clicking through email tabs.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group"
                        >
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/25 transition-colors">
                                {f.icon}
                            </div>
                            <div>
                                <h3 className="text-white text-sm font-semibold mb-1">{f.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative z-10 max-w-3xl mx-auto">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="relative rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-900/30 via-purple-900/20 to-pink-900/20 p-10 text-center overflow-hidden"
                >
                    {/* Inner glow */}
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-500/20 blur-3xl rounded-full" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
                            <Download className="w-7 h-7 text-white" />
                        </div>

                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                                Ready to send smarter?
                            </h2>
                            <p className="text-gray-400 max-w-md mx-auto">
                                Download the app, connect your email, and send all your job applications
                                in seconds, not hours.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-center">
                            <DownloadButtons />
                        </div>

                        <p className="text-gray-500 text-xs">
                            Free for all CandidAI users · No additional setup required
                        </p>
                    </div>
                </motion.div>
            </section>
        </div>
    );
}

// Keep legacy export for backwards compatibility if needed
export { DownloadPage as Emails };
