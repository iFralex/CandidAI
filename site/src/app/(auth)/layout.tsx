import Link from "next/link";
import { Check, Zap, Target, TrendingUp } from "lucide-react";

const features = [
  { icon: Zap, text: "Personalized AI-crafted emails in seconds" },
  { icon: Target, text: "Deep company research for every application" },
  { icon: TrendingUp, text: "Up to 90% response rate from recruiters" },
  { icon: Check, text: "Auto-follow-up to maximize your chances" },
];

export default async function AuthLayout({ children }) {
  return (
    <div className="dark min-h-svh bg-black text-white flex flex-col lg:flex-row">
      {/* Left: Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-12 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,theme(colors.violet.900/60%),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-10 group">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-violet-500/20">
              <img src="/logo.png" alt="CandidAI" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              CandidAI
            </span>
          </Link>

          {/* Form card */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur-sm">
            {children}
          </div>
        </div>
      </div>

      {/* Right: Brand panel (desktop only) */}
      <div className="hidden lg:flex lg:w-[46%] relative items-center justify-center p-12 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-purple-950 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_60%_40%,theme(colors.violet.600/25%),transparent)]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right,rgb(167,139,250) 1px,transparent 1px),linear-gradient(to bottom,rgb(167,139,250) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            Trusted by 5,000+ job seekers
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-4">
            Land your dream job{" "}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              10× faster
            </span>
          </h2>

          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            AI-powered cold emails personalized for every company. Stop spending hours on applications that get ignored.
          </p>

          <ul className="space-y-4 mb-12">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-gray-300">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ul>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "90%", label: "Response rate" },
              { value: "2 min", label: "Per application" },
              { value: "3×", label: "More interviews" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="bg-white/[0.04] border border-white/10 rounded-xl p-3 text-center"
              >
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
