"use client"

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type NavigationLink = {
    label: string;
    href: string;
};

const DEFAULT_LINKS: NavigationLink[] = [
    { label: "Features", href: "/#features" },
    { label: "How it Works", href: "/#process" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Reviews", href: "/#reviews" },
];

export const Navigation = ({ simple = false, links }: { simple?: boolean; links?: NavigationLink[] }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const visibleLinks = links ?? (simple ? [] : DEFAULT_LINKS);

    return (
        <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center space-x-2" aria-label="CandidAI home">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                        </div>

                        <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                            CandidAI
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center space-x-8">
                        {visibleLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors">
                                {link.label}
                            </Link>
                        ))}
                        <Link href="/dashboard">
                            <Button variant="primary" size="sm">
                                Get Started
                            </Button>
                        </Link>
                    </div>

                    <button
                        type="button"
                        className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 md:hidden"
                        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-navigation-menu"
                        onClick={() => setMobileOpen((open) => !open)}
                    >
                        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <div id="mobile-navigation-menu" className="border-t border-white/10 bg-black/95 px-6 py-5 backdrop-blur-xl md:hidden">
                    <div className="mx-auto flex max-w-7xl flex-col gap-1">
                        {visibleLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="rounded-lg px-3 py-3 text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                                onClick={() => setMobileOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Link href="/dashboard" className="mt-3" onClick={() => setMobileOpen(false)}>
                            <Button variant="primary" size="sm" className="w-full">Get Started</Button>
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
};
