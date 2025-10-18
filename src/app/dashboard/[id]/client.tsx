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
    const inProgress = !data.recruiter_summary
    if (inProgress)
        data.recruiter_summary = { "name": "Lauren Crabb", "experience": [{ "location_names": ["London, England, United Kingdom"], "start_date": "2021-11", "title": { "name": "Senior People Partner (Sales & Technical Services)", "sub_role": "human_resources", "levels": ["senior"], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": true, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png", "name": "Google", "twitter_url": "twitter.com/google", "location": { "name": "Mountain View, California, United States", "postal_code": "94043", "continent": "North America", "street_address": "1600 Amphitheatre Parkway", "region": "California", "metro": "San Jose, California", "country": "United States", "locality": "Mountain View", "geo": "37.39,-122.06", "address_line_2": null }, "linkedin_id": "1441", "industry": "Internet", "founded": 1998, "id": "aKCIYBNF9ey6o5CjHCCO4goHYKlf", "size": "10001+", "facebook_url": "facebook.com/google", "website": "google.com", "linkedin_url": "linkedin.com/company/google" }, "end_date": null }, { "location_names": ["Mountain View, California, United States", "Mexico City, Mexico City, Mexico"], "start_date": "2019-08", "title": { "name": "People Partner (Platforms and Ecosystems)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png", "name": "Google", "twitter_url": "twitter.com/google", "location": { "name": "Mountain View, California, United States", "postal_code": "94043", "continent": "North America", "street_address": "1600 Amphitheatre Parkway", "region": "California", "metro": "San Jose, California", "country": "United States", "locality": "Mountain View", "geo": "37.39,-122.06", "address_line_2": null }, "linkedin_id": "1441", "industry": "Internet", "founded": 1998, "id": "aKCIYBNF9ey6o5CjHCCO4goHYKlf", "size": "10001+", "facebook_url": "facebook.com/google", "website": "google.com", "linkedin_url": "linkedin.com/company/google" }, "end_date": "2021-11" }, { "location_names": ["San Francisco, California, United States"], "start_date": "2019-02", "title": { "name": "Global Human Resources Business Partner (Worldwide Sales & Operations)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQU-0sgMITwNqzwWbNZfDxjhGmmje755YgLHQ&s", "name": "Airbnb", "twitter_url": "twitter.com/airbnb", "location": { "name": "San Francisco, California, United States", "postal_code": "94103", "continent": "North America", "street_address": "888 Brannan Street", "region": "California", "metro": "San Francisco, California", "country": "United States", "locality": "San Francisco", "geo": "37.74,-122.45", "address_line_2": null }, "linkedin_id": "309694", "industry": "Internet", "founded": 2008, "id": "9fGW9Je0KfwfNPtyouflTQneENKN", "size": "5001-10000", "facebook_url": "facebook.com/airbnb", "website": "airbnb.com", "linkedin_url": "linkedin.com/company/airbnb" }, "end_date": "2019-07" }, { "location_names": ["San Francisco, California, United States"], "start_date": "2018-04", "title": { "name": "Human Resources Manager, Global Meraki Bu (Tech + Non-Sales)", "sub_role": "human_resources", "levels": ["manager"], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456", "name": "Cisco Meraki", "twitter_url": "twitter.com/meraki", "location": { "name": "San Francisco, California, United States", "postal_code": "94158", "continent": "North America", "street_address": "500 Terry A. Francois Boulevard", "region": "California", "metro": "San Francisco, California", "country": "United States", "locality": "San Francisco", "geo": "37.74,-122.45", "address_line_2": null }, "linkedin_id": "92950", "industry": "Computer Networking", "founded": 2006, "id": "uXlBn3JswjCAx85kpThCvwWuDLxQ", "size": "1001-5000", "facebook_url": "facebook.com/ciscomeraki", "website": null, "linkedin_url": "linkedin.com/company/cisco-meraki" }, "end_date": "2019-02" }, { "location_names": ["San Francisco, California, United States"], "start_date": "2016-08", "title": { "name": "Human Resources Business Partner (Software / Hardware / Product Mgmt)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456", "name": "Cisco Meraki", "twitter_url": "twitter.com/meraki", "location": { "name": "San Francisco, California, United States", "postal_code": "94158", "continent": "North America", "street_address": "500 Terry A. Francois Boulevard", "region": "California", "metro": "San Francisco, California", "country": "United States", "locality": "San Francisco", "geo": "37.74,-122.45", "address_line_2": null }, "linkedin_id": "92950", "industry": "Computer Networking", "founded": 2006, "id": "uXlBn3JswjCAx85kpThCvwWuDLxQ", "size": "1001-5000", "facebook_url": "facebook.com/ciscomeraki", "website": null, "linkedin_url": "linkedin.com/company/cisco-meraki" }, "end_date": "2019-02" }, { "location_names": [], "start_date": "2010-06", "title": { "name": "Human Resources Advisor (Recruitment, Selection Policy and Standards)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1024px-LinkedIn_icon.svg.png", "name": "London Borough of Camden", "twitter_url": "twitter.com/camdentalking", "location": { "name": "London, England, United Kingdom", "postal_code": null, "continent": "Europe", "street_address": "5 Pancras Square", "region": "England", "metro": null, "country": "United Kingdom", "locality": "London", "geo": "51.46,-0.20", "address_line_2": null }, "linkedin_id": "14499", "industry": "Government Administration", "founded": null, "id": "m6QBbKx4WI1XgBnC1R2xXwzz7NFX", "size": "5001-10000", "facebook_url": "facebook.com/grncamden", "website": "camden.gov.uk", "linkedin_url": "linkedin.com/company/london-borough-of-camden" }, "end_date": "2011-05" }, { "location_names": [], "start_date": "2009-07", "title": { "name": "Human Resources Advisor (Employment Initiatives)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1024px-LinkedIn_icon.svg.png", "name": "London Borough of Camden", "twitter_url": "twitter.com/camdentalking", "location": { "name": "London, England, United Kingdom", "postal_code": null, "continent": "Europe", "street_address": "5 Pancras Square", "region": "England", "metro": null, "country": "United Kingdom", "locality": "London", "geo": "51.46,-0.20", "address_line_2": null }, "linkedin_id": "14499", "industry": "Government Administration", "founded": null, "id": "m6QBbKx4WI1XgBnC1R2xXwzz7NFX", "size": "5001-10000", "facebook_url": "facebook.com/grncamden", "website": "camden.gov.uk", "linkedin_url": "linkedin.com/company/london-borough-of-camden" }, "end_date": "2010-06" }, { "location_names": [], "start_date": "2007-08", "title": { "name": "Leadership Consultant", "sub_role": null, "levels": [], "role": null, "class": null }, "is_primary": false, "company": { "logo_url": "https://pngdownload.io/wp-content/uploads/2023/12/Apple-Logo-Iconic-Tech-Brand-Symbol-PNG-Transparent-Representation-of-Innovation-and-Design-jpg.webp", "name": "Human Assets LTD", "twitter_url": "twitter.com/humanassetsltd", "location": { "name": "London, England, United Kingdom", "postal_code": null, "continent": "Europe", "street_address": "28 Ulysses Road", "region": "England", "metro": null, "country": "United Kingdom", "locality": "London", "geo": "51.46,-0.20", "address_line_2": null }, "linkedin_id": "1583215", "industry": "Human Resources", "founded": 1987, "id": "u2eo7wIyyEDXgExnUkuXLATKH88O", "size": "1-10", "facebook_url": null, "website": "humanassets.co.uk", "linkedin_url": "linkedin.com/company/human-assets-ltd" }, "end_date": "2009-07" }], "location": { "country": "United Kingdom", "continent": "Europe" }, "skills": ["360 Feedback", "Airflow", "Algebraic Combinatorics", "Algorithms", "C++", "Change Management", "Cheesecakes", "Coaching", "Combinatorics", "Computer Science", "Etl", "Facebook", "Facilitation", "Game Design", "Human Resources", "Mathematical Analysis", "Mathematics", "Matlab", "Microsoft Excel", "Microsoft Office", "Microsoft Word", "Neural Networks", "Organizational Design", , "Powerpoint", "Project Planning", "Psychometrics", "Public Sector", "Public Speaking", "Python", "Recruiting", "Redis", "Research", "Stakeholder Management", "Statistics", "Strategy", "Succession Planning", "Talent Management", "Teaching", ,], "title": "Senior People Partner (Sales & Technical Services)", "education": [{ "minors": [], "start_date": "2006", "degrees": ["Master of Science", "Masters"], "school": { "logo_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtRig-9cUpSg95-hbB_GTx8gySkR8fIq6SvQ&s", "name": "University of Surrey", "domain": "surrey.ac.uk", "location": { "name": "Guildford, England, United Kingdom", "locality": "Guildford", "continent": "Europe", "region": "England", "country": "United Kingdom" }, "linkedin_id": "8369", "type": "post-secondary institution", "id": "PZ-O4dspmqcSoCmg46LW9A_0", "facebook_url": "facebook.com/universityofsurrey", "website": "surrey.ac.uk", "linkedin_url": "linkedin.com/school/university-of-surrey", "twitter_url": "twitter.com/uniofsurrey" }, "gpa": null, "majors": ["Psychology"], "end_date": "2007" }, { "minors": [], "start_date": null, "degrees": ["Bachelor of Science", "Bachelors"], "school": { "logo_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtRig-9cUpSg95-hbB_GTx8gySkR8fIq6SvQ&s", "name": "University of California, Davis", "domain": "ucdavis.edu", "location": { "name": "Davis, California, United States", "locality": "Davis", "continent": "North America", "region": "California", "country": "United States" }, "linkedin_id": "2842", "type": "post-secondary institution", "id": "OBL5pZtjTCqcV0YQ6rpb7Q_0", "facebook_url": "facebook.com/ucdavis", "website": "ucdavis.edu", "linkedin_url": "linkedin.com/school/uc-davis", "twitter_url": "twitter.com/ucdavis" }, "gpa": null, "majors": [], "end_date": "2015" }, { "minors": [], "start_date": null, "degrees": [], "school": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Stemma_sapienza.png", "name": "University of California", "domain": "universityofcalifornia.edu", "location": { "name": "Oakland, California, United States", "locality": "Oakland", "continent": "North America", "region": "California", "country": "United States" }, "linkedin_id": "2843", "type": "post-secondary institution", "id": "vy-30YJaHfPKMIrQv0hZHg_0", "facebook_url": null, "website": "jobs.universityofcalifornia.edu", "linkedin_url": "linkedin.com/school/university-of-california", "twitter_url": null }, "gpa": null, "majors": [], "end_date": null }] }
    return (
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-violet-400" /> Recruiter Summary
                </h3>
                <div className={(inProgress ? "bg-gray-800 " : "") + "relative rounded-md"}>
                    {inProgress && <Overlay />}
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
                </div>
            </Card>
        </motion.div>
    );
};

const Overlay = () => {
    return (
        <div className="absolute inset-0 z-50 isolate flex items-center justify-center">
            {/* Layer blur dell'overlay */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-md"></div>

            {/* Contenuto dell'overlay sopra il blur */}
            <div className="relative flex flex-col items-center justify-center space-y-4">
                <span className="text-white text-xl font-semibold animate-pulse">In progress…</span>
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
    )
}

const EmailGenerated = ({ data }: { data: any }) => {
    const inProgress = !data?.email
    const placeholderText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse eu nibh dolor. Fusce at odio id magna interdum fermentum a id lectus. Donec lacinia nunc id felis tincidunt, eu pretium nunc rutrum. Fusce pretium aliquet cursus. Donec sollicitudin hendrerit tellus, eu dapibus sapien dictum vitae. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec pharetra mattis magna, in pellentesque neque fringilla nec. Etiam vel tempor neque.
Sed et nisi elementum, placerat nisl sit amet, consectetur enim. Morbi nec purus neque. Phasellus in odio nec massa condimentum iaculis ultrices in nisl. Sed feugiat ante eget orci interdum, eu porttitor neque suscipit. Aliquam eget mauris in augue scelerisque imperdiet viverra at magna. Fusce at interdum sapien. Ut ultricies massa dui, rhoncus ultrices mauris interdum sed. Nunc diam felis, ultricies nec magna eget, molestie fermentum lorem. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.
Nam condimentum varius ipsum, sit amet rutrum eros. Nullam malesuada sem quis rutrum egestas. Integer eu efficitur magna, sit amet pellentesque leo. Aenean consequat purus vitae sapien rhoncus, eget fringilla ipsum ullamcorper. Donec et turpis tincidunt, scelerisque sapien ut, varius nisi. Proin ut placerat ipsum. Nulla eget semper nibh. Integer id suscipit eros, eget lacinia sem. Praesent fermentum egestas aliquet. Cras ultricies sit amet nulla eget viverra. Fusce lobortis mauris tellus, sit amet rutrum sapien venenatis eu. Pellentesque erat quam, feugiat dignissim ultricies a, vestibulum et leo. Pellentesque placerat hendrerit feugiat. Donec sit amet tortor et tortor lobortis vehicula at et nisi. Nulla accumsan ultrices aliquam. Nulla dictum nunc nec sem molestie, vel dictum ipsum convallis.
`
    return (
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-violet-400" /> Email Generated
                </h3>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className={(!data.email ? "bg-gray-900 " : "") + "rounded-md relative grid grid-cols-5 gap-4"}
                >
                    {/* Overlay elegante: visibile solo se manca l'email */}
                    {inProgress && (
                        <Overlay />
                    )}

                    {/* Contenuto sottostante */}
                    <motion.div variants={itemVariants} className="col-span-4">
                        <Textarea rows={12} defaultValue={data.email || placeholderText} disabled={inProgress} />
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1 space-y-4">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button className="w-full">Send email</Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button className="w-full" variant={"outline"}>Generate another</Button>
                        </motion.div>
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
    const inProgress = !data.blog_posts
    return (
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <Newspaper className="w-5 h-5 mr-2 text-violet-400" /> Blog Post Selected
                </h3>
                <div className={(inProgress ? "bg-gray-900 " : "") + "relative rounded-md"}>
                    {inProgress && <Overlay />}
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
                </div>
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