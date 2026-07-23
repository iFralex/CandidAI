// components/DashboardLayout.tsx (rimane un Server Component per la struttura)
// Non usare 'use client'

import { Activity, BarChart3, Building2, Home, Settings, Zap, Bell, MailCheck, Plus, HelpCircle } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarClientWrapper } from '@/components/SidebarClientWrapper';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ResendEmailVerificationBtn } from '@/components/onboarding';
import { TutorialProvider } from '@/components/TutorialContext';
import { TutorialOverlay } from '@/components/TutorialOverlay';

// 1. Dati di navigazione definiti nel Server Component (meno JS client)
const navigationItems = [
    { name: 'Dashboard', icon: <Home className="w-5 h-5" />, href: '/dashboard', tutorialId: 'nav-dashboard' },
    { name: 'Send All', icon: <Activity className="w-5 h-5" />, href: '/dashboard/send-all', tutorialId: 'nav-send-all' },
    { name: 'Follow Ups', icon: <Bell className="w-5 h-5" />, href: '/dashboard/follow-ups', tutorialId: 'nav-follow-ups' },
    { name: 'Plan & Credits', icon: <BarChart3 className="w-5 h-5" />, href: '/dashboard/plan-and-credits', tutorialId: 'nav-credits' },
    { name: 'Support', icon: <HelpCircle className="w-5 h-5" />, href: '/dashboard/help', tutorialId: 'nav-support' },
    { name: 'Settings', icon: <Settings className="w-5 h-5" />, href: '/dashboard/settings', tutorialId: 'nav-settings' }
];

const orbPositions = [
    { left: '10%', top: '15%' },
    { left: '70%', top: '5%' },
    { left: '40%', top: '60%' },
    { left: '85%', top: '45%' },
    { left: '20%', top: '80%' },
    { left: '60%', top: '30%' },
];

const AnimatedBackground = () => {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-purple-900/10 to-pink-900/10"></div>
            {['#8b5cf6', '#a855f7', '#c084fc', '#e879f9', '#f472b6', '#fb7185'].map((color, i) => (
                <div
                    key={i}
                    className={`absolute w-72 h-72 rounded-full blur-xl opacity-10 animate-pulse`}
                    style={{
                        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                        left: orbPositions[i].left,
                        top: orbPositions[i].top,
                        animationDelay: `${i * 2}s`,
                        animationDuration: `${4 + i}s`
                    }}
                />
            ))}
        </div>
    );
};


export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) {
        return redirect('/login')
        //throw new Error(res.status);
    }
    const data = await res.json();

    if (!data.success)
        return redirect('/login')
    //throw new Error(data.error)

    const user = data.user
    if (!user)
        redirect('/login')

    const onboarded = (user.onboardingStep || 1) > 10
    const credits = user.credits
    const maxCompanies: number | undefined = user.maxCompanies
    const companiesUsed: number | undefined = user.companiesUsed

    return (
        <TutorialProvider>
        <div className="min-h-screen bg-black text-white relative">
            <AnimatedBackground />
            <TutorialOverlay />

            <SidebarProvider>
                {onboarded && <SidebarClientWrapper user={user} navigationItems={navigationItems} />}
                {/* Main Content */}
                <div className="w-full">
                    <header className="bg-black/20 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                {/* 3. Il pulsante Menu (interattivo) è ora nel Client Component */}
                                {onboarded && <SidebarTrigger />}
                                {!onboarded && (
                                    <Link href="/" aria-label="CandidAI home">
                                        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                                        </div>
                                    </Link>
                                )}
                                <div>
                                    <h1 className="text-2xl font-bold text-white">{onboarded ? "Dashboard" : "Your first application"}</h1>
                                    {!onboarded && (
                                        <p className="text-sm text-gray-400">
                                            Profile, contact, and email in one guided flow
                                        </p>
                                    )}
                                </div>
                            </div>

                            {onboarded && (
                                <div className="flex items-center gap-2">
                                    {typeof maxCompanies === 'number' && (
                                        <Link href="/dashboard/plan-and-credits#plans">
                                            <Badge variant={"secondary"} className="cursor-pointer hover:bg-white/10 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-5 h-5 text-violet-400" />
                                                    <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                                        {companiesUsed ?? 0}/{maxCompanies}
                                                    </span>
                                                </div>
                                            </Badge>
                                        </Link>
                                    )}
                                    {typeof credits === 'number' && (
                                        <Link href="/dashboard/plan-and-credits#credits">
                                            <Badge variant={"secondary"} className="cursor-pointer hover:bg-white/10 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                                    <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                                                        {credits}
                                                    </span>
                                                </div>
                                            </Badge>
                                        </Link>
                                    )}
                                    <Link href="/dashboard/plan-and-credits">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" title="Buy credits or upgrade plan">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </header>

                    <main className="p-6 relative z-10">
                        {children}
                        {!user.emailVerified && (
                            <Dialog open>
                                <DialogContent showCloseButton={false} className="border-violet-500/20 bg-gray-950/95 backdrop-blur-xl max-w-md">
                                    <div className="flex flex-col items-center gap-6 text-center py-2">
                                        {/* Icon with glow */}
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-violet-500/30 blur-xl rounded-full" />
                                            <div className="relative bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-2xl p-4">
                                                <MailCheck className="w-10 h-10 text-violet-400" />
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <div className="space-y-2">
                                            <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                                                Verify Your Email
                                            </h2>
                                            <p className="text-gray-400 text-sm leading-relaxed">
                                                We've sent a verification link to{" "}
                                                <span className="text-violet-300 font-medium">{user.email}</span>.
                                                <br />Check your inbox to continue.
                                            </p>
                                        </div>

                                        {/* Resend button */}
                                        <ResendEmailVerificationBtn />

                                        {/* Note */}
                                        <p className="text-xs text-gray-600">
                                            Didn't receive it? Check your spam folder or resend above.
                                        </p>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </main>
                </div>
            </SidebarProvider>
        </div>
        </TutorialProvider>
    );
}

// Nota: il layout può essere creato direttamente come Layout file in Next.js App Router:
// /app/dashboard/layout.tsx -> 'export default async function DashboardLayout...'
