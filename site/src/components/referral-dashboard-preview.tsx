import Image from "next/image";
import { BarChart3, Copy, Euro, LayoutDashboard, Link2, QrCode, ShoppingBag, UserPlus, Users } from "lucide-react";

const metrics = [
    { label: "QR scans", value: "1,284", change: "+18.7%", icon: QrCode },
    { label: "Signups", value: "312", change: "+22.4%", icon: UserPlus },
    { label: "Qualifying purchases", value: "47", change: "+27.0%", icon: ShoppingBag },
    { label: "Estimated commission", value: "€286.65", change: "+31.6%", icon: Euro, accent: true },
];

const activity = [
    ["QR scan", "Career Day poster", "2 min ago", "—"],
    ["Signup", "Personal QR card", "18 min ago", "—"],
    ["Purchase", "Referral link", "1 hr ago", "€8.75"],
    ["Purchase", "Campus event", "3 hrs ago", "€8.75"],
];

export function ReferralDashboardPreview() {
    return (
        <div className="min-w-[760px] overflow-hidden rounded-xl border border-white/10 bg-[#080b14] text-left text-white lg:min-w-0">
            <div className="grid grid-cols-[142px_1fr] xl:grid-cols-[180px_1fr]">
                <aside className="border-r border-white/10 bg-[#070912] p-4">
                    <div className="mb-7 flex items-center gap-2 font-bold">
                        <Image src="/logo2.png" alt="" width={28} height={28} className="h-7 w-7" />
                        <span>CandidAI</span>
                    </div>
                    <nav className="space-y-1.5 text-xs text-gray-400" aria-label="Ambassador dashboard navigation">
                        {[
                            [LayoutDashboard, "Overview", true], [Users, "Referrals", false],
                            [BarChart3, "Analytics", false], [Euro, "Commission", false], [Link2, "Resources", false],
                        ].map(([Icon, label, active]) => {
                            const NavIcon = Icon as typeof LayoutDashboard;
                            return <div key={String(label)} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${active ? "bg-violet-500/20 text-violet-200" : ""}`}><NavIcon className="h-4 w-4" />{String(label)}</div>;
                        })}
                    </nav>
                </aside>

                <div className="p-4 xl:p-5">
                    <header className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">Ambassador dashboard</p>
                            <h3 className="text-base font-semibold">Welcome back, Alex</h3>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-gray-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Real-time
                        </div>
                    </header>

                    <div className="grid grid-cols-4 gap-3">
                        {metrics.map((metric) => {
                            const Icon = metric.icon;
                            return (
                                <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3.5">
                                    <div className="mb-3 flex items-center justify-between text-[10px] text-gray-400"><span>{metric.label}</span><Icon className="h-4 w-4 text-violet-400" /></div>
                                    <div className={`text-xl font-bold ${metric.accent ? "text-emerald-400" : "text-white"}`}>{metric.value}</div>
                                    <div className="mt-1 text-[9px] text-emerald-400">{metric.change} <span className="text-gray-600">vs previous period</span></div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3 grid grid-cols-[1.4fr_0.8fr] gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                            <div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-semibold">Conversion trend</h4><span className="text-[9px] text-gray-500">Last 30 days</span></div>
                            <svg viewBox="0 0 520 145" className="h-32 w-full" role="img" aria-label="Rising thirty-day conversion trend">
                                {[25, 65, 105].map(y => <line key={y} x1="8" x2="512" y1={y} y2={y} stroke="rgba(255,255,255,.08)" strokeDasharray="4 5" />)}
                                <defs><linearGradient id="referralChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".35"/><stop offset="1" stopColor="#8b5cf6" stopOpacity="0"/></linearGradient></defs>
                                <path d="M8 113 C35 90 51 102 77 77 S119 95 145 70 S188 75 216 82 S255 45 286 61 S326 73 350 48 S389 62 418 30 S466 52 512 38 L512 137 L8 137 Z" fill="url(#referralChartFill)" />
                                <path d="M8 113 C35 90 51 102 77 77 S119 95 145 70 S188 75 216 82 S255 45 286 61 S326 73 350 48 S389 62 418 30 S466 52 512 38" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>

                        <div className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                                <div className="flex items-center justify-between"><h4 className="text-xs font-semibold">Commission tier</h4><span className="text-[10px] text-violet-300">15% → 20%</span></div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" /></div>
                                <p className="mt-2 text-[9px] text-gray-500">14 more qualifying purchases to unlock 20%</p>
                            </div>
                            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
                                <div className="flex items-center justify-between"><div><h4 className="text-xs font-semibold">Your referral link</h4><p className="mt-1 text-[9px] text-gray-500">candidai.tech/r/alex</p></div><Copy className="h-4 w-4 text-violet-300" /></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                        <h4 className="mb-3 text-xs font-semibold">Recent activity</h4>
                        <div className="divide-y divide-white/[0.06] text-[9px]">
                            {activity.map(([type, source, time, value]) => <div key={`${type}-${time}`} className="grid grid-cols-[0.75fr_1.4fr_0.8fr_0.5fr] gap-3 py-2 text-gray-400"><span className="text-gray-200">{type}</span><span>{source}</span><span>{time}</span><span className={value !== "—" ? "text-emerald-400" : ""}>{value}</span></div>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
