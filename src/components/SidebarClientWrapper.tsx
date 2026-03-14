'use client';

import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { User, Mail, CreditCard, LogOut } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavigationItem {
    name: string;
    icon: React.ReactNode;
    href: string;
}

interface SidebarClientWrapperProps {
    user: any;
    navigationItems: NavigationItem[];
}

export function SidebarClientWrapper({ user, navigationItems }: SidebarClientWrapperProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            await fetch('/api/logout');
            router.push('/login');
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    return (
        <Sidebar>
            <SidebarHeader className="mt-6">
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
                            {navigationItems.map((item) => {
                                const isActive =
                                    item.href === '/dashboard'
                                        ? pathname === '/dashboard'
                                        : pathname.startsWith(item.href);
                                return (
                                    <SidebarMenuItem key={item.name}>
                                        <SidebarMenuButton asChild isActive={isActive} size="lg">
                                            <a href={item.href}>
                                                {item.icon}
                                                <span>{item.name}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="p-4 hover:bg-white/5 rounded-lg cursor-pointer">
                            <div className="flex items-center space-x-3">
                                {user?.picture ? (
                                    <Image
                                        src={user.picture}
                                        alt={user.name || 'User'}
                                        width={40}
                                        height={40}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                                    <p className="text-xs text-gray-400">{user?.email || ''}</p>
                                </div>
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/profile" className="flex items-center gap-2 cursor-pointer">
                                <User className="w-4 h-4" />
                                View Profile
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/sent-emails" className="flex items-center gap-2 cursor-pointer">
                                <Mail className="w-4 h-4" />
                                All Sent Emails
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/billing" className="flex items-center gap-2 cursor-pointer">
                                <CreditCard className="w-4 h-4" />
                                Billing
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4" />
                            Log Out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
