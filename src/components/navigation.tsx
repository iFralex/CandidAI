"use client"

import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/authContext";

export const Navigation = () => {
    const { user, loading } = useAuth();

    return (
        <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                            RecruiterAI
                        </span>
                    </div>

                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
                        <a href="#process" className="text-gray-300 hover:text-white transition-colors">How it Works</a>
                        <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
                        <a href="#reviews" className="text-gray-300 hover:text-white transition-colors">Reviews</a>
                        {!loading && <Button variant="primary" size="sm">
                            {!user ? <>Get Started</> : user.name}
                        </Button>}
                    </div>

                    <button
                        className="md:hidden text-white"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                {false && (
                    <div className="md:hidden bg-black/30 backdrop-blur-lg border-t border-white/10">
                        <div className="px-2 pt-2 pb-3 space-y-1">
                            <a href="#features" className="block px-3 py-2 text-gray-300 hover:text-white">Features</a>
                            <a href="#process" className="block px-3 py-2 text-gray-300 hover:text-white">How it Works</a>
                            <a href="#pricing" className="block px-3 py-2 text-gray-300 hover:text-white">Pricing</a>
                            <a href="#reviews" className="block px-3 py-2 text-gray-300 hover:text-white">Reviews</a>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};