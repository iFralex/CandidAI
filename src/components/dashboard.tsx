"use client"

import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ArrowRight, Badge, BarChart3, CheckCircle, Crown, ExternalLink, Mail, Plus, RefreshCw, Send, Timer } from "lucide-react";
import { Card } from "./ui/card";
import Image from "next/image";
import { motion } from 'framer-motion';

const listVariants = {
    visible: {
        opacity: 1,
        transition: {
            when: "beforeChildren",
            staggerChildren: 0.1, // Applica un ritardo tra ogni item
        },
    },
    hidden: {
        opacity: 0,
    },
};

const itemVariants = {
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    hidden: { opacity: 0, y: 20 },
};

export const AnimatedResults = ({ children }) => {
    return (
        <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={listVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Mappiamo i children per avvolgerli in un motion.div */}
            {React.Children.map(children, (child) => (
                <motion.div variants={itemVariants}>{child}</motion.div>
            ))}
        </motion.div>
    );
};

function getCachedLogo(company) {
    if (typeof window === "undefined") return null;
    const item = localStorage.getItem(`logo_${company}`);
    if (!item) return null;

    try {
        const parsed = JSON.parse(item);
        const now = Date.now();

        // Controlla se è scaduto
        if (now - parsed.timestamp > 24 * 60 * 60 * 1000) {
            localStorage.removeItem(`logo_${company}`);
            return null;
        }
        return parsed.url;
    } catch {
        localStorage.removeItem(`logo_${company}`);
        return null;
    }
}

// Funzione helper per salvare in cache
function cacheLogo(company, url) {
    const data = {
        url,
        timestamp: Date.now(),
    };
    localStorage.setItem(`logo_${company}`, JSON.stringify(data));
}

// Funzione per controllare se un link è ancora valido
async function isUrlValid(url) {
    try {
        const response = await fetch(url, { method: "HEAD" });
        return response.ok;
    } catch {
        return false;
    }
}

export const CompanyLogo = ({ company, maxSize=12 }) => {
    const [logo, setLogo] = useState(null);

    useEffect(() => {
        if (!company) return;

        const loadLogo = async () => {
            let cached = getCachedLogo(company);

            // Se c'è una cache, verifica se è ancora valida
            if (cached && (await isUrlValid(cached))) {
                setLogo(cached);
                return;
            }

            // Altrimenti, fai il fetch
            const icon = await fetchLogo(company);
            if (icon) {
                cacheLogo(company, icon);
                setLogo(icon);
            }
        };

        loadLogo();
    }, [company]);

    return (
        <div className={"relative aspect-square w-full rounded-xl flex items-center justify-center bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold overflow-hidden"} style={{maxWidth: "calc(var(--spacing) * " + (maxSize || 24).toString() + ")"}}>
            {logo ? (
                <Image
                    src={logo}
                    alt={`${company} logo`}
                    className="w-full h-full object-contain"
                    fill
                />
            ) : (
                company?.charAt(0).toUpperCase()
            )}
        </div>
    );

};

async function fetchLogo(domain) {
    if (logoCache.has(domain)) {
        return logoCache.get(domain);
    }

    try {
        const res = await fetch(
            `https://api.brandfetch.io/v2/search/${encodeURIComponent(domain)}?limit=1`,
            { cache: "force-cache" }
        );

        if (res.ok) {
            const data = await res.json();
            const icon = Array.isArray(data) && data[0]?.icon ? data[0].icon : null;
            logoCache.set(domain, icon);
            return icon;
        }
    } catch (e) {
        console.error("Errore fetch logo:", e);
    }

    logoCache.set(domain, null);
    return null;
}

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

const logoCache = new Map();

const Dashboard = ({ results }) => {

    const processingCampaigns = results.filter(c => c.status === 'processing').length;
    const readyCampaigns = results.filter(c => c.status === 'ready').length;
    const sentCampaigns = results.filter(c => c.status === 'sent').length;
    const totalEmailsGenerated = results.reduce((sum, c) => sum + c.emailsGenerated, 0);

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome back! 👋
                    </h1>
                    <p className="text-gray-400">
                        Here's what's happening with your job search campaigns
                    </p>
                </div>

                <Button
                    variant="primary"
                    icon={<Plus className="w-4 h-4" />}
                >
                    New Campaign
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6" gradient>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Processing</p>
                            <p className="text-2xl font-bold text-white">{processingCampaigns}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Ready to Send</p>
                            <p className="text-2xl font-bold text-white">{readyCampaigns}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Emails Sent</p>
                            <p className="text-2xl font-bold text-white">{sentCampaigns}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <Send className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Total Generated</p>
                            <p className="text-2xl font-bold text-white">{totalEmailsGenerated}</p>
                        </div>
                        <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                            <Mail className="w-6 h-6 text-violet-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Active Campaigns */}
            <Card className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Active Campaigns</h2>
                    <Badge variant="primary">{results.length} total</Badge>
                </div>

                <Results results={results} />
            </Card>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6" gradient>
                    <h3 className="text-xl font-semibold text-white mb-4">Need Help?</h3>
                    <p className="text-gray-300 mb-4">
                        Check out our guides and tips to maximize your job search success.
                    </p>
                    <Button variant="secondary" icon={<ExternalLink className="w-4 h-4" />}>
                        View Resources
                    </Button>
                </Card>

                <Card className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Upgrade Plan</h3>
                    <p className="text-gray-300 mb-4">
                        Get more companies, advanced filters, and priority processing with Pro or Ultra plans.
                    </p>
                    <Button variant="primary" icon={<Crown className="w-4 h-4" />}>
                        Upgrade Now
                    </Button>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard