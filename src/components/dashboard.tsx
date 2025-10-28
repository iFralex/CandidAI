"use client"

import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { AlertCircle, ArrowDown, ArrowDown01, ArrowRight, Badge, BarChart3, Building2, Calendar, Check, CheckCircle, ChevronDown, Crown, ExternalLink, Globe, Loader, Loader2, Mail, MapPin, Plus, Puzzle, RefreshCw, RotateCcw, Save, Send, Timer, TrendingUp, Users, X } from "lucide-react";
import { Card } from "./ui/card";
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import Link from "next/link";
import { confirmCompany } from "@/actions/onboarding-actions";
import { Input } from "./ui/input";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { AddStrategyButton, AdvancedFiltersClient } from "./onboarding";
import { Textarea } from "./ui/textarea";

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

export const AnimatedResults = ({ className, children }) => {
    return (
        <motion.div
            className={"grid gap-6 " + className}
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

export const CompanyLogo = ({ company, link, maxSize = 12, minSize = 12 }) => {
    const [logo, setLogo] = useState(link || null);

    useEffect(() => {
        if (!company || link) return;

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
            console.log(icon)
        };

        loadLogo();
    }, [company]);

    return (
        <div className={"relative aspect-square w-full rounded-xl flex items-center justify-center bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold overflow-hidden"} style={{ maxWidth: "calc(var(--spacing) * " + (maxSize || 12).toString() + ")", minWidth: "calc(var(--spacing) * " + (minSize || 12).toString() + ")" }}>
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

export const ConfirmCompanies = ({ allDetails, userId, queries, defaultInstructions }) => {
    const [selections, setSelections] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [newCompanyData, setNewCompanyData] = useState({
        name: '',
        domain: '',
        linkedin_url: ''
    });
    const [strategies, setStrategies] = useState({});
    const [customInstructions, setCustomInstructions] = useState({});
    const [expandedCards, setExpandedCards] = useState({});

    const formatNumber = (num) => {
        if (!num) return 'N/A';
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
        return num.toString();
    };

    const formatCurrency = (amount) => {
        if (!amount) return null;
        return `$${formatNumber(amount)}`;
    };

    const toggleCard = (companyId) => {
        setExpandedCards(prev => ({
            ...prev,
            [companyId]: !prev[companyId]
        }));
    };

    const handleResetCustomStrategy = companyId => {
        setStrategies(prev => {
            const updated = { ...prev };
            delete updated[companyId];
            return updated;
        })
    }
    
    const handleResetCustomInstructions = companyId => {
        setCustomInstructions(prev => {
            const updated = { ...prev };
            delete updated[companyId];
            return updated;
        })
    }

    const handleSelectConfirm = (companyId, newName, linkedin_url, domain) => {
        setSelections(prev => ({
            ...prev,
            [companyId]: {
                action: 'confirm',
                newData: {
                    name: newName,
                    linkedin_url,
                    domain
                },
            }
        }));
    };

    const handleSelectWrong = (companyId) => {
        const company = allDetails.find(item => item.companyId === companyId);
        setEditingCompany(companyId);
        setNewCompanyData({
            name: company?.data?.company?.name || '',
            domain: company?.data?.company?.domain || '',
            linkedin_url: company?.data?.company?.linkedin_url || ''
        });
    };

    const handleSaveWrongCompany = (companyId) => {
        setSelections(prev => ({
            ...prev,
            [companyId]: {
                action: 'wrong',
                newData: { ...newCompanyData }
            }
        }));
        setEditingCompany(null);
        setNewCompanyData({ name: '', domain: '', linkedin_url: '' });
    };

    const handleRemoveSelection = companyId => {
        setSelections(prev => {
            const newSelections = { ...prev };
            delete newSelections[companyId];
            return newSelections;
        });
        handleResetCustomStrategy(companyId)
        handleResetCustomInstructions(companyId)
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const filteredStrategies = Object.fromEntries(Object.entries(strategies).filter(([k, v]) => v !== queries))
            const filteredInstructions = Object.fromEntries(Object.entries(customInstructions).filter(([k, v]) => v !== defaultInstructions))

            await confirmCompany(userId, selections, filteredStrategies, filteredInstructions)

            // Dopo il salvataggio, resetta le selezioni
            setSelections({});
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetAll = () => {
        setSelections({})
        setStrategies({})
        setCustomInstructions({})
    }

    const pendingCount = Object.keys(selections).length;
    const confirmedCount = Object.values(selections).filter(s => s.action === 'confirm').length;
    const wrongCount = Object.values(selections).filter(s => s.action === 'wrong').length;

    return (
        <div className="relative">
            {isSaving && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <Loader2 className="w-16 h-16 text-white animate-spin" />
            </div>}

            <ScrollArea className="max-h-screen overflow-y-auto">
                <div className="h-7" />

                {/* Companies List */}
                <AnimatePresence>
                    <motion.div
                        className={"grid grid-cols-2 gap-6"}
                        variants={listVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {allDetails?.map((item) => {
                            const company = item.data?.company_info;
                            const companyId = item.companyId;
                            const selection = selections[companyId];
                            const isSelected = !!selection;
                            const isExpanded = expandedCards[companyId];

                            return (
                                <motion.div
                                    key={companyId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="relative"
                                >
                                    <Card className={`p-6 border-2 transition-all duration-200 relative ${isSelected
                                        ? selection.action === 'confirm'
                                            ? 'border-green-500 bg-green-500/5'
                                            : 'border-yellow-500 bg-yellow-500/5'
                                        : 'border-gray-700 hover:bg-white/5'
                                        }`} onClick={() => toggleCard(companyId)}
                                    >
                                        {/* Selection Badge */}
                                        <div className="absolute top-0 left-0 right-0 transform  -translate-y-1/2 flex items-center justify-center gap-3 z-10">
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className={`px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg ${selection.action === 'confirm'
                                                        ? 'bg-green-900 text-white border border-green-500'
                                                        : 'bg-yellow-900 text-white border border-yellow-500'
                                                        }`}
                                                >
                                                    {selection.action === 'confirm' ? (
                                                        <>
                                                            <Check className="w-4 h-4" />
                                                            Confirmed
                                                        </>
                                                    ) : (
                                                        <>
                                                            <AlertCircle className="w-4 h-4" />
                                                            It's wrong - Change it
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}

                                            {strategies[companyId] && JSON.stringify(strategies[companyId] || queries) !== JSON.stringify(queries) && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg bg-blue-900 text-white border border-blue-500"
                                                >
                                                    <Puzzle className="w-4 h-4" />
                                                    Custom Strategies Added
                                                </motion.div>
                                            )}

                                            {customInstructions[companyId] !== undefined && customInstructions[companyId] !== defaultInstructions && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg bg-purple-900 text-white border border-purple-500"
                                                >
                                                    <Puzzle className="w-4 h-4" />
                                                    Custom Instructions Added
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-6 gap-4">
                                            <div className="flex items-start space-x-4 flex-1">
                                                <CompanyLogo company={company.website || company.name} />
                                                <div className="flex-1">
                                                    <h3 className="text-xl font-semibold text-white mb-1">
                                                        {company.display_name || company.name}
                                                    </h3>
                                                    {company.headline && (
                                                        <p className="text-gray-400 text-sm mb-2">
                                                            {company.headline}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-3 text-sm">
                                                        {company.website && (
                                                            <Link
                                                                href={"https://" + company.website}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                                                            >
                                                                <Globe className="w-4 h-4" />
                                                                {company.website}
                                                            </Link>
                                                        )}
                                                        {company.location && (
                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                <MapPin className="w-4 h-4" />
                                                                {company.location.name || company.location.country}
                                                            </span>
                                                        )}
                                                        {company.founded && (
                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                <Calendar className="w-4 h-4" />
                                                                Founded {company.founded}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex grid grid-cols-1 gap-2" onClick={(e) => e.stopPropagation()}>
                                                {!isSelected ? (
                                                    <>
                                                        <Button
                                                            onClick={() => handleSelectConfirm(
                                                                companyId,
                                                                company.display_name,
                                                                company.linkedin_url,
                                                                company.website
                                                            )}
                                                            icon={<Check className="w-4 h-4" />}
                                                        >
                                                            Confirm
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleSelectWrong(companyId)}
                                                            variant="secondary"
                                                            icon={<X className="w-4 h-4" />}
                                                            className="text-red-500"
                                                        >
                                                            Wrong Company
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        onClick={() => handleRemoveSelection(companyId)}
                                                        variant="secondary"
                                                        icon={<X className="w-4 h-4" />}
                                                        className="bg-red-600/30 hover:bg-red-700"
                                                    >
                                                        Cancel Selection
                                                    </Button>
                                                )}
                                                {isSelected && selection.action === 'confirm' && (
                                                    <>
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    onClick={() => { }}
                                                                    icon={<Plus className="w-4 h-4" />}
                                                                >
                                                                    Custom Strategy
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className={"sm:max-w-4xl w-4xl max-h-screen"}>
                                                                <DialogHeader>
                                                                    <DialogTitle className="flex">
                                                                        Define Custom Strategies for {company.display_name}
                                                                    </DialogTitle>
                                                                </DialogHeader>
                                                                <ScrollArea className="oveflow-y-auto max-h-[calc(100vh-200px)]">
                                                                    <AdvancedFiltersClient maxStrategies={30} setStrategy={(s) => setStrategies(prev => ({ ...prev, [companyId]: s }))} strategy={strategies[companyId] || queries} />
                                                                </ScrollArea>
                                                                <DialogFooter>
                                                                    <DialogClose>
                                                                        <Button variant={"ghost"}>
                                                                            Close
                                                                        </Button>
                                                                    </DialogClose>
                                                                    <Button variant={"outline"} onClick={() => handleResetCustomStrategy(companyId)} disabled={!strategies[companyId] || JSON.stringify(strategies[companyId]) === JSON.stringify(queries)}>
                                                                        Reset to default
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    icon={<Plus className="w-4 h-4" />}
                                                                >
                                                                    Custom Instructions
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className={"sm:max-w-4xl w-4xl max-h-screen"}>
                                                                <DialogHeader>
                                                                    <DialogTitle className="flex">
                                                                        Define Custom Instructions for {company.display_name}
                                                                    </DialogTitle>
                                                                </DialogHeader>
                                                                <ScrollArea className="oveflow-y-auto max-h-[calc(100vh-200px)]">
                                                                    <div className="p-1">
                                                                        <Textarea rows={5} value={customInstructions[companyId] !== undefined ? customInstructions[companyId] : defaultInstructions} onChange={e => setCustomInstructions(prev => ({...prev, [companyId]: e.target.value }))} />
                                                                    </div>
                                                                </ScrollArea>
                                                                <DialogFooter>
                                                                    <DialogClose>
                                                                        <Button variant={"ghost"}>
                                                                            Close
                                                                        </Button>
                                                                    </DialogClose>
                                                                    <Button variant={"outline"} onClick={() => handleResetCustomInstructions(companyId)} disabled={customInstructions[companyId] === undefined || customInstructions[companyId] === defaultInstructions}>
                                                                        Reset to default
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Show correction details if wrong company was selected */}
                                        {isSelected && selection.action === 'wrong' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                                            >
                                                <div className="text-yellow-400 font-semibold mb-2 text-sm">
                                                    📝 New company data:
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-gray-400">Name:</p>
                                                        <p className="text-white">{selection.newData.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400">Domain:</p>
                                                        <p className="text-white">{selection.newData.domain || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400">LinkedIn:</p>
                                                        <p className="text-white truncate">{selection.newData.linkedin_url || "-"}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {!isExpanded && (
                                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-10">
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0.5 }}
                                                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 1 }}
                                                    className="bg-white/5 text-white px-2 py-1 rounded-full shadow-lg flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                                                >
                                                    <ChevronDown className="w-8 h-8" />
                                                </motion.div>
                                            </div>
                                        )}

                                        <motion.div
                                            initial={false}
                                            animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            {/* Grid Info */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                                {company.employee_count && (
                                                    <div className="bg-white/5 rounded-lg p-3">
                                                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                                            <Users className="w-3 h-3" />
                                                            EMPLOYEES
                                                        </div>
                                                        <div className="text-white font-semibold">
                                                            {formatNumber(company.employee_count)}
                                                            {company.size && (
                                                                <span className="text-gray-400 text-sm ml-2">
                                                                    ({company.size})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {company.industry_v2 && (
                                                    <div className="bg-white/5 rounded-lg p-3">
                                                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                                            <Building2 className="w-3 h-3" />
                                                            INDUSTRY
                                                        </div>
                                                        <div className="text-white font-semibold text-sm">
                                                            {company.industry_v2}
                                                        </div>
                                                    </div>
                                                )}

                                                {company.total_funding_raised && (
                                                    <div className="bg-white/5 rounded-lg p-3">
                                                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                                            <TrendingUp className="w-3 h-3" />
                                                            TOTAL FUNDING
                                                        </div>
                                                        <div className="text-white font-semibold">
                                                            {formatCurrency(company.total_funding_raised)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Summary */}
                                            {company.summary && (
                                                <div className="bg-white/5 rounded-lg p-4 mb-4">
                                                    <p className="text-gray-300 text-sm leading-relaxed line-clamp-8">
                                                        {company.summary}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Tags & Extra */}
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                {company.tags && company.tags.length > 0 && (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {company.tags.slice(0, 10).map((tag, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {company.tags.length > 10 && (
                                                            <span className="text-gray-400 text-xs">
                                                                +{company.tags.length - 10} more
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {company.type && (
                                                    <span className="text-gray-400">
                                                        Type: <span className="text-white">{company.type ? company.type.charAt(0).toUpperCase() + company.type.slice(1) : ""}</span>
                                                    </span>
                                                )}
                                                {company.ticker && (
                                                    <span className="text-gray-400">
                                                        Ticker:{" "}
                                                        <span className="text-white font-mono">
                                                            {company.ticker}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Employee Distribution */}
                                            {company.employee_count_by_country &&
                                                Object.keys(company.employee_count_by_country).length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                                        <div className="text-xs text-gray-400 mb-2">
                                                            EMPLOYEE DISTRIBUTION
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(company.employee_count_by_country)
                                                                .sort(([, a], [, b]) => b - a)
                                                                .slice(0, 5)
                                                                .map(([country, count]) => (
                                                                    <span
                                                                        key={country}
                                                                        className="text-xs bg-white/5 px-2 py-1 rounded text-gray-300"
                                                                    >
                                                                        {country?.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}: {formatNumber(count)}
                                                                    </span>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                        </motion.div>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>

                {/* Edit Dialog */}
                <Dialog open={editingCompany} onOpenChange={() => {
                    setEditingCompany(null);
                    setNewCompanyData({ name: '', domain: '', linkedin_url: '' });
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Set the correct company information
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">New name</label>
                                <Input
                                    type="text"
                                    value={newCompanyData.name}
                                    onChange={(e) => setNewCompanyData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Es: Acme Corporation"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">New domain</label>
                                <Input
                                    type="text"
                                    value={newCompanyData.domain}
                                    onChange={(e) => setNewCompanyData(prev => ({ ...prev, domain: e.target.value }))}
                                    placeholder="Es: acme.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">New LinkedIn URL</label>
                                <Input
                                    type="text"
                                    value={newCompanyData.linkedin_url}
                                    onChange={(e) => setNewCompanyData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                                    placeholder="Es: https://linkedin.com/company/acme"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose>
                                <Button
                                    variant="secondary"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                onClick={() => handleSaveWrongCompany(editingCompany)}
                                icon={<Check className="w-4 h-4" />}
                                disabled={!newCompanyData.name || (() => {
                                    const company = allDetails.find(i => i.companyId === editingCompany)?.data?.company;
                                    return company &&
                                        newCompanyData.name === company.name &&
                                        (!newCompanyData.domain || newCompanyData.domain === company.domain) &&
                                        (!newCompanyData.linkedin_url || newCompanyData.linkedin_url === company.linkedin_url);
                                })()}
                            >
                                Confirm Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {pendingCount > 0 && <div className="h-32" />}
                <ScrollBar orientation="vertical" />
            </ScrollArea>
            {/* Floating Action Bar */}
            <AnimatePresence>
                {pendingCount > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-6 left-1/2 transform -translate-x-1/2"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-4 flex items-center gap-6 border border-white/20">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 rounded-full p-2">
                                    <AlertCircle className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-white">
                                    <div className="font-semibold text-lg">
                                        {pendingCount} changes pending
                                    </div>
                                    <div className="text-sm text-white/80">
                                        {confirmedCount > 0 && `${confirmedCount} confirmed`}
                                        {confirmedCount > 0 && wrongCount > 0 && ' • '}
                                        {wrongCount > 0 && `${wrongCount} to correct`}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 ml-4">
                                <Button
                                    onClick={handleResetAll}
                                    variant="secondary"
                                    icon={<RotateCcw className="w-4 h-4" />}
                                    className="bg-white/20 hover:bg-white/30"
                                    disabled={isSaving}
                                >
                                    Reset
                                </Button>
                                <Button
                                    onClick={handleSaveAll}
                                    disabled={isSaving}
                                    icon={isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-6"
                                >
                                    {isSaving ? 'Saving...' : 'Save All'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div >
    );
};