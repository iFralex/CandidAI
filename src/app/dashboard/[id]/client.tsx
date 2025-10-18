// app/result/[id]/ResultClient.tsx

"use client";

import { CompanyLogo } from "@/components/dashboard";
import SkillsListBase, { EducationList, ExperienceList } from "@/components/detailsServer";
import { CriteriaDisplay } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Link as LinkIcon, Brain, Check, CheckCircle2, Mail, Newspaper, Search, User, Linkedin } from "lucide-react";
import Link from "next/link";
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProgressBar } from "@/components/ui/progress-bar";

// ============== ANIMATION VARIANTS ==============
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 12
        }
    }
};

const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    }
};

const stepVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: i * 0.15,
            type: "spring",
            stiffness: 120,
            damping: 12
        }
    })
};

const statsVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i: number) => ({
        opacity: 1,
        scale: 1,
        transition: {
            delay: i * 0.1,
            type: "spring",
            stiffness: 100,
            damping: 12
        }
    })
};

// ============== HELPER FUNCTIONS ==============
const calculateProgress = (data: any) => {
    let progress = 0;
    if (data.blog_posts) progress += 50;
    if (data.recruiter_summary) progress += 30;
    if (data.email) progress += 20;
    return progress;
};

const getStepStatus = (data: any, step: string) => {
    if (step === 'blog_posts') return data.blog_posts ? 'completed' : 'pending';
    if (step === 'recruiter_summary') return data.recruiter_summary ? 'completed' : 'pending';
    if (step === 'email') return data.email ? 'completed' : 'pending';
    return 'pending';
};


// ============== CLIENT COMPONENTS ==============

const Step = ({ title, status, index }: { title: string; status: 'completed' | 'in-progress' | 'pending'; index: number }) => {
    return (
        <motion.div
            custom={index}
            variants={stepVariants}
            initial="hidden"
            animate="visible"
            className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all duration-300 ${status === 'completed'
                ? 'bg-green-500/10 border-green-500/30 shadow-sm shadow-green-500/10'
                : status === 'in-progress'
                    ? 'bg-blue-500/10 border-blue-500/30 shadow-sm shadow-blue-500/10'
                    : 'bg-gray-500/5 border-gray-500/20'
                }`}
        >
            <motion.div
                animate={status === 'completed' ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${status === 'completed'
                    ? 'bg-green-500/20 text-green-400 shadow-sm shadow-green-500/20'
                    : status === 'in-progress'
                        ? 'bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/20'
                        : 'bg-gray-500/10 text-gray-500'
                    }`}
            >
                {status === 'completed' && <Check size={16} strokeWidth={2.5} />}
                {status === 'in-progress' && <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />}
                {status === 'pending' && <div className="w-2.5 h-2.5 rounded-full bg-gray-500/50" />}
            </motion.div>
            <span className={`text-sm font-medium transition-colors duration-300 ${status === 'completed'
                ? 'text-green-400'
                : status === 'in-progress'
                    ? 'text-blue-400'
                    : 'text-gray-500'
                }`}>
                {title}
            </span>
            {status === 'completed' && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/5 to-transparent pointer-events-none" />
            )}
            {status === 'in-progress' && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none animate-pulse" />
            )}
        </motion.div>
    );
};

function CompanyHeader({ data }: { data: any }) {
    const progress = calculateProgress(data);
    const blogStatus = getStepStatus(data, 'blog_posts');
    const recruiterStatus = getStepStatus(data, 'recruiter_summary');
    const emailStatus = getStepStatus(data, 'email');

    let inProgressStep = '';
    if (blogStatus === 'pending') inProgressStep = 'blog';
    else if (recruiterStatus === 'pending') inProgressStep = 'recruiter';
    else if (emailStatus === 'pending') inProgressStep = 'email';

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4 flex gap-6 w-full"
        >
            <motion.div variants={itemVariants} className="w-48">
                <CompanyLogo company={data.company.domain || data.company.name} maxSize={40} />
            </motion.div>
            <div className="w-full">
                <div className="flex flex-wrap gap-6">
                    <div className="flex-1 mb-4">
                        <div className="w-full flex items-center space-x-4">
                            <motion.div variants={itemVariants} className="flex-1">
                                <h1 className="text-4xl font-semibold text-white">{data.company.name}</h1>
                            </motion.div>
                            <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
                                {data.company.domain && (
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <Link href={`https://${data.company.domain}`} target="_blank" rel="noopener noreferrer">
                                            <div className="bg-gray-500/20 hover:bg-gray-500/30 p-2 rounded-lg transition-colors">
                                                <LinkIcon />
                                            </div>
                                        </Link>
                                    </motion.div>
                                )}
                                {data.company.linkedin_url && (
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <Link href={`https://${data.company.linkedin_url}`} target="_blank" rel="noopener noreferrer">
                                            <div className="bg-blue-500/20 hover:bg-blue-500/30 p-2 rounded-lg transition-colors">
                                                <Linkedin />
                                            </div>
                                        </Link>
                                    </motion.div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
                <motion.div variants={itemVariants} className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <ProgressBar progress={progress} />
                        </div>
                        <motion.span
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="text-lg font-semibold text-white text-right"
                        >
                            {progress}%
                        </motion.span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <Step
                            title="Blog posts Found"
                            status={blogStatus === 'completed' ? 'completed' : inProgressStep === 'blog' ? 'in-progress' : 'pending'}
                            index={0}
                        />
                        <Step
                            title="Recruiter Found"
                            status={recruiterStatus === 'completed' ? 'completed' : inProgressStep === 'recruiter' ? 'in-progress' : 'pending'}
                            index={1}
                        />
                        <Step
                            title="Email Generated"
                            status={emailStatus === 'completed' ? 'completed' : inProgressStep === 'email' ? 'in-progress' : 'pending'}
                            index={2}
                        />
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

function BlogCard() {
    const article = {
        title: "Guida Completa a Next.js e Tailwind CSS",
        text: "Scopri come creare applicazioni web moderne e performanti utilizzando Next.js insieme a Tailwind CSS. In questa guida esploreremo le best practices, i pattern più comuni e come ottimizzare il tuo workflow di sviluppo.",
        link: "/blog/guida-nextjs-tailwind"
    };
    return (
        <motion.div
            variants={cardVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
        >
            <article>
                <h2 className="text-2xl font-bold text-white mb-3">{article.title}</h2>
                <p className="text-gray-400 mb-4 line-clamp-3">{article.text}</p>
                <Link href={article.link} className="inline-flex items-center text-gray-200 hover:text-blue-800 font-semibold transition-colors group">
                    Read more
                    <motion.div animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </motion.div>
                </Link>
            </article>
        </motion.div>
    );
}

const RecruiterProfileCard = ({ data }: { data: any }) => {
    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };
    const name = data?.recruiter_summary?.name || 'Nome Cognome';
    const title = data?.recruiter_summary?.title || 'Job Title';
    const location = data?.recruiter_summary?.location?.country || 'Location';
    const initials = getInitials(name);
    return (
        <motion.div variants={itemVariants} className="rounded-lg space-y-8">
            <div className="flex items-center space-x-4">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 150, damping: 15 }}
                    className="w-24 h-24 rounded-full bg-violet-500/30 border border-violet-500 flex items-center justify-center text-white font-semibold text-xl flex-shrink-0"
                >
                    {initials}
                </motion.div>
                <motion.div variants={itemVariants} className="flex-1 min-w-0">
                    <h3 className="text-2xl font-semibold text-white truncate">{name}</h3>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{location}</span>
                    </p>
                </motion.div>
            </div>
            <motion.div variants={itemVariants}>
                <Link href={data?.recruiter_summary?.linkedin_url || "#"} target="_blank" rel="noopener noreferrer">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button className="w-full">View on Linkedin</Button>
                    </motion.div>
                </Link>
            </motion.div>
            <motion.div variants={itemVariants}>
                <Dialog>
                    <DialogTrigger asChild>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button className="w-full" variant={"outline"}>Find someone else</Button>
                        </motion.div>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Do you want to search for another recruiter profile?</DialogTitle>
                            <DialogDescription>You will be redirected to the onboarding flow to specify new criteria.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
                            <Link href="/onboarding/recruiter"><Button>Yes, take me there</Button></Link>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </motion.div>
        </motion.div>
    );
};

const RecruiterSummary = ({ data }: { data: any }) => {
    return (
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-violet-400" /> Recruiter Summary
                </h3>
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-4 gap-16 p-2">
                    <motion.div variants={itemVariants} className="col-span-1">
                        <div><RecruiterProfileCard data={data} /></div>
                        <Separator className="my-5" />
                        <motion.div variants={itemVariants} className="col-span-1">
                            <p className="text-sm text-gray-400 mb-3">Key Skills</p>
                            <SkillsListBase skills={data.recruiter_summary.skills} editable={false} />
                        </motion.div>
                    </motion.div>
                    <motion.div variants={itemVariants} className="col-span-3">
                        <div>
                            <p className="text-sm text-gray-400 mb-3">Experience</p>
                            <ul className="grid grid-cols-3 gap-4"><ExperienceList experience={data.recruiter_summary.experience} /></ul>
                        </div>
                        <Separator className="my-5" />
                        <div>
                            <p className="text-sm text-gray-400 mb-3">Education</p>
                            <ul className="grid grid-cols-3 gap-4"><EducationList education={data.recruiter_summary.education} /></ul>
                        </div>
                    </motion.div>
                </motion.div>
                <div className="p-2">
                    <Separator className="my-5" />
                    <p className="text-sm text-gray-400 mb-3">{data.recruiter_summary.name} matches this criteria - {data.query.name}</p>
                    <CriteriaDisplay criteria={data.query.criteria} />
                </div>
            </Card>
        </motion.div>
    );
};

const EmailGenerated = ({ data }: { data: any }) => {
    return (
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-violet-400" /> Email Generated
                </h3>
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-5 gap-4">
                    <motion.div variants={itemVariants} className="col-span-4">
                        <Textarea rows={12} />
                    </motion.div>
                    <motion.div variants={itemVariants} className="col-span-1 space-y-4">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Button className="w-full">Send email</Button></motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Button className="w-full" variant={"outline"}>Generate another</Button></motion.div>
                        <div className="p-4 font-sans">
                            <h2 className="text-2xl font-semibold mb-4">Email perfect because:</h2>
                            <motion.ul variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                                {['È chiara e diretta', 'Ha un tono professionale', 'Invita all\'azione'].map((item, i) => (
                                    <motion.li key={i} variants={itemVariants} className="flex items-center">
                                        <Check className="text-green-500 mr-2 w-5 h-5" />
                                        <span>{item}</span>
                                    </motion.li>
                                ))}
                            </motion.ul>
                        </div>
                    </motion.div>
                </motion.div>
            </Card>
        </motion.div>
    );
};

const BlogPostsSection = ({ data }: { data: any }) => {
    return (
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <Newspaper className="w-5 h-5 mr-2 text-violet-400" /> Blog Post Selected
                </h3>
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-4">
                    <BlogCard /><BlogCard /><BlogCard />
                </motion.div>
                <Separator className="my-5" />
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-5">
                    {[
                        { label: 'Posts found', value: '1', icon: Search, color: 'blue' },
                        { label: 'Posts Deeply Analyzed', value: '1', icon: Brain, color: 'blue' },
                        { label: 'Posts selected', value: '1', icon: CheckCircle2, color: 'blue' }
                    ].map((stat, i) => (
                        <motion.div key={i} custom={i} variants={statsVariants} whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                            <Card className="p-6 backdrop-blur-none" /* gradient prop is not standard, assuming custom component */>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                                        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 + 0.3 }} className="text-2xl font-bold text-white">
                                            {stat.value}
                                        </motion.p>
                                    </div>
                                    <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }} className={`w-12 h-12 bg-${stat.color}-500/20 rounded-xl flex items-center justify-center`}>
                                        <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                                    </motion.div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </Card>
        </motion.div>
    );
};


// ============== MAIN CLIENT COMPONENT ==============
// Questo è il componente principale che assembla tutte le parti animate
// e riceve i dati dal componente Server.
export default function ResultClient({ data }: { data: any }) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-16"
        >
            <CompanyHeader data={data} />
            <EmailGenerated data={data} />
            <RecruiterSummary data={data} />
            <BlogPostsSection data={data} />
        </motion.div>
    );
}