"use client"

import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const Navigation = ({ simple = false }: { simple?: boolean }) => {
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
                        {!simple && (
                            <>
                                <Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
                                <Link href="#process" className="text-gray-300 hover:text-white transition-colors">How it Works</Link>
                                <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
                                <Link href="#reviews" className="text-gray-300 hover:text-white transition-colors">Reviews</Link>
                            </>
                        )}
                        <Link href="/dashboard">
                            <Button variant="primary" size="sm">
                                Get Started
                            </Button>
                        </Link>
                    </div>

                    <button className="md:hidden text-white">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </nav>
    );
};