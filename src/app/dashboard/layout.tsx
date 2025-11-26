// components/DashboardLayout.tsx (rimane un Server Component per la struttura)
// Non usare 'use client'

import { Activity, BarChart3, FileText, Home, LogOut, Settings, Sparkles, Menu, Zap, Bell, MailCheck } from 'lucide-react'; // Importa le icone
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import Image from 'next/image';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { resendEmailVerification } from '@/actions/onboarding-actions';
import { ResendEmailVerificationBtn } from '@/components/onboarding';

// Tipo di dati utente (puoi prenderlo dal tuo sistema di auth)
interface User {
    name: string;
    email: string;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    user: User; // Questi dati possono essere passati o fetchati qui
    currentStep?: number | null;
    totalSteps?: number | null;
}

// 1. Dati di navigazione definiti nel Server Component (meno JS client)
const navigationItems = [
    { name: 'Dashboard', icon: <Home className="w-5 h-5" />, href: '/dashboard', active: true },
    { name: 'Send All', icon: <Activity className="w-5 h-5" />, href: '/dashboard/send-all' },
    { name: 'Follow Ups', icon: <Bell className="w-5 h-5" />, href: '/dashboard/follow-ups' },
    { name: 'Settings', icon: <Settings className="w-5 h-5" />, href: '/settings' }
];

const AnimatedBackground = () => {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-purple-900/10 to-pink-900/10"></div>
            {[...Array(6)].map((_, i) => (
                <div
                    key={i}
                    className={`absolute w-72 h-72 rounded-full blur-xl opacity-10 animate-pulse`}
                    style={{
                        background: `radial-gradient(circle, ${['#8b5cf6', '#a855f7', '#c084fc', '#e879f9', '#f472b6', '#fb7185'][i]
                            } 0%, transparent 70%)`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${i * 2}s`,
                        animationDuration: `${4 + i}s`
                    }}
                />
            ))}
        </div>
    );
};

function AppSidebar({ user }) {
    return (
        <Sidebar>
            <SidebarHeader className='mt-6 '>
                <div className="pb-6 border-b border-white/10">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                            CandidAI
                        </span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navigationItems.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton asChild isActive={item.active} size={"lg"}>
                                        <a href={item.href}>
                                            {item.icon}
                                            <span>{item.name}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <Link href="/dashboard/profile">
                    <div className="p-4 hover:bg-white/5 rounded-lg cursor-pointer">
                        <div className="flex items-center space-x-3">
                            {user?.picture ? (
                                <Image
                                    src={user.picture}
                                    alt={user.name || 'User'}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                                <p className="text-xs text-gray-400">{user?.email || 'User'}</p>
                            </div>
                        </div>
                    </div>
                </Link>
            </SidebarFooter>           </Sidebar>
    )
}

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: await cookies()
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
    const currentStep = user.onboardingStep
    const totalSteps = user.plan === 'pro' || user.plan === 'ultimate' ? 5 : 4
    const credits = user.credits

    return (
        <div className="min-h-screen bg-black text-white relative">
            <AnimatedBackground />

            <SidebarProvider>
                {onboarded && <AppSidebar user={user} />}
                {/* Main Content */}
                <div className="w-full">
                    <header className="bg-black/20 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                {/* 3. Il pulsante Menu (interattivo) è ora nel Client Component */}
                                {onboarded && <SidebarTrigger />}
                                <div>
                                    <h1 className="text-2xl font-bold text-white">{onboarded ? "Dashboard" : "Onboarding"}</h1>
                                    {!onboarded && currentStep && totalSteps && (
                                        <p className="text-sm text-gray-400">
                                            Setup Progress: Step {currentStep} of {totalSteps}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {!onboarded && currentStep && totalSteps && (
                                <div className="flex items-center space-x-4">
                                    <div className="w-48">
                                        <ProgressBar progress={(currentStep / totalSteps) * 100} />
                                    </div>
                                    <span className="text-sm text-gray-400">
                                        {Math.round((currentStep / totalSteps) * 100)}%
                                    </span>
                                </div>
                            )}
                            {onboarded && credits && (
                                <Badge variant={"secondary"}>
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                        <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                                            {credits}
                                        </span>
                                    </div>
                                </Badge>
                            )}
                        </div>
                    </header>

                    <main className="p-6 relative z-10">
                        {children}
                        {currentStep >= 1 && !user.emailVerified && (
                            <Dialog open>
                                <DialogContent showCloseButton={false}>
                                    <div className="flex flex-col items-center gap-4 text-center">
                                        {/* Icon */}
                                        <MailCheck className="w-12 h-12 text-violet-500" />

                                        {/* Title */}
                                        <h2 className="text-xl font-semibold">
                                            Verify Your Email
                                        </h2>

                                        {/* Description */}
                                        <p className="">
                                            We've sent a verification email at {user.email} to your inbox. Please check your email to continue.
                                        </p>

                                        {/* Resend button */}
                                        <ResendEmailVerificationBtn />

                                        {/* Note */}
                                        <p className="text-sm text-gray-500">
                                            Didn't receive the email? You can resend it using the button above.
                                        </p>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </main>
                </div>
            </SidebarProvider>
        </div>
    );
}

// Nota: il layout può essere creato direttamente come Layout file in Next.js App Router:
// /app/dashboard/layout.tsx -> 'export default async function DashboardLayout...'