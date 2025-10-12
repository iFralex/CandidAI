// components/DashboardLayout.tsx (rimane un Server Component per la struttura)
// Non usare 'use client'

import { Activity, BarChart3, FileText, Home, LogOut, Settings, Sparkles, Menu } from 'lucide-react'; // Importa le icone
import { SidebarClientWrapper } from '@/components/SidebarClientWrapper'; // Il Client Component che gestirà lo stato
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getServerUser } from '@/lib/server-auth';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { clientConfig, serverConfig } from '@/config';

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
    { name: 'Campaigns', icon: <Activity className="w-5 h-5" />, href: '/campaigns' },
    { name: 'Templates', icon: <FileText className="w-5 h-5" />, href: '/templates' },
    { name: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, href: '/analytics' },
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

const ProgressBar = ({ progress, className = '' }) => {
    return (
        <div className={`w-full bg-white/10 rounded-full h-2 overflow-hidden ${className}`}>
            <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
        </div>
    );
};

function AppSidebar({ user }) {
    return (
        <Sidebar>
            <SidebarHeader className='mt-6 '>
                <div className="pb-6 border-b border-white/10">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                            RecruiterAI
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
                            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
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

export default async function DashboardLayout({ children }: Readonly<{children: React.ReactNode;}>) {
    const res = await fetch("http://localhost:3000/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: await cookies()
        }
    });

    if (!res.ok) {
        throw new Error(res.status);
    }
    const data = await res.json();

    if (!data.success)
        throw new Error(data.error)

    const user = data.user
    if (!user)
        redirect('/login')

    const onboarded = (user.onboardingStep || 1) > 10
    const currentStep = user.onboardingStep
    const totalSteps = user.plan === 'pro' || user.plan === 'ultimate' ? 5 : 4

    return (
        <div className="min-h-screen bg-black text-white relative">
            <AnimatedBackground />

            <SidebarProvider>
                {onboarded && <AppSidebar user={user} />}
                {/* Main Content */}
                <div className="w-full">
                    {onboarded && <header className="bg-black/20 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                {/* 3. Il pulsante Menu (interattivo) è ora nel Client Component */}
                                <SidebarTrigger />
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                                    {currentStep && totalSteps && (
                                        <p className="text-sm text-gray-400">
                                            Setup Progress: Step {currentStep} of {totalSteps}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {currentStep && totalSteps && (
                                <div className="flex items-center space-x-4">
                                    <div className="w-48">
                                        <ProgressBar progress={(currentStep / totalSteps) * 100} />
                                    </div>
                                    <span className="text-sm text-gray-400">
                                        {Math.round((currentStep / totalSteps) * 100)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </header>}

                    <main className="p-6 relative z-10">
                        {children}
                    </main>
                </div>
            </SidebarProvider>
        </div>
    );
}

// Nota: il layout può essere creato direttamente come Layout file in Next.js App Router:
// /app/dashboard/layout.tsx -> 'export default async function DashboardLayout...'