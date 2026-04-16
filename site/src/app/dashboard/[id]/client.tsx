// app/result/[id]/ResultClient.tsx

"use client";

import { track } from "@/lib/analytics";
import { CompanyLogo } from "@/components/dashboard";
import SkillsListBase, { calculateProgress, EducationList, ExperienceList } from "@/components/detailsServer";
import { AdvancedFiltersClient, CriteriaDisplay } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Link as LinkIcon, Brain, Check, CheckCircle2, Mail, Newspaper, Search, User, Linkedin, FileText, Copy, Download, ChevronRight, Lock, XCircle, Play, Pencil, Clock } from "lucide-react";
import Link from "next/link";
import { CreditSelector } from "@/components/CreditSelector";
import { UnifiedCheckout } from "@/components/UnifiedCheckout";
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProgressBar } from "@/components/ui/progress-bar";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTutorial as useTutorialHook } from "@/components/TutorialContext";

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

export const getStepStatus = (data: any, step: string) => {
  if (step === 'blog_articles') return data.blog_articles ? 'completed' : 'pending';
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
  const blogStatus = getStepStatus(data, 'blog_articles');
  const recruiterStatus = getStepStatus(data, 'recruiter_summary');
  const emailStatus = getStepStatus(data, 'email');
  const [isDevMode, setIsDevMode] = useState(false);
  const [devRunning, setDevRunning] = useState(false);
  const [devStatus, setDevStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  useEffect(() => {
    setIsDevMode(document.cookie.includes('__dev_mode__=1'));
    const resultId = window.location.pathname.split("/").filter(Boolean).pop() ?? "unknown";
    const status = progress >= 100 ? "completed" : progress > 0 ? "in_progress" : "pending";
    track({ name: "campaign_view", params: { result_id: resultId, status } });
  }, []);

  let inProgressStep = '';
  if (recruiterStatus === 'pending') inProgressStep = 'recruiter';
  else if (blogStatus === 'pending') inProgressStep = 'blog';
  else if (emailStatus === 'pending') inProgressStep = 'email';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col sm:flex-row gap-6 w-full space-y-4 sm:space-y-0"
    >
      {/* Logo */}
      <motion.div variants={itemVariants} className="w-48 flex-shrink-0 mx-auto sm:mx-0">
        <CompanyLogo company={data.company.domain || data.company.name} maxSize={40} />
      </motion.div>

      {/* Contenuti */}
      <div className="w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-row flex-wrap gap-6 items-start sm:items-center">
          <div className="flex-1 mb-4 sm:mb-0">
            <div className="w-full flex flex-wrap items-center gap-4">
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
                {isDevMode && (
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <button
                      onClick={async () => {
                        setDevRunning(true);
                        setDevStatus('idle');
                        try {
                          await startServer();
                          setDevStatus('ok');
                        } catch {
                          setDevStatus('err');
                        } finally {
                          setDevRunning(false);
                        }
                      }}
                      disabled={devRunning}
                      title="[DEV] Run server for this user"
                      className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                        devStatus === 'ok'
                          ? 'bg-green-500/20 text-green-400'
                          : devStatus === 'err'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400'
                      }`}
                    >
                      {devRunning
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Play size={16} />}
                      DEV
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Progress bar e step */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 w-full">
              <ProgressBar progress={progress} />
            </div>
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="text-lg font-semibold text-white text-right sm:text-left"
            >
              {progress}%
            </motion.span>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            <Step
              title="Recruiter Found"
              status={recruiterStatus === 'completed' ? 'completed' : inProgressStep === 'recruiter' ? 'in-progress' : 'pending'}
              index={1}
            />
            <Step
              title="Blog posts Found"
              status={blogStatus === 'completed' ? 'completed' : inProgressStep === 'blog' ? 'in-progress' : 'pending'}
              index={0}
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

function BlogCard({ article }) {
  if (!article)
    article = {
      title: "Guida Completa a Next.js e Tailwind CSS",
      markdown: "Scopri come creare applicazioni web moderne e performanti utilizzando Next.js insieme a Tailwind CSS. In questa guida esploreremo le best practices, i pattern più comuni e come ottimizzare il tuo workflow di sviluppo.",
      url: "/blog/guida-nextjs-tailwind"
    };
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-white/5 hover:bg-white/10 rounded-lg p-4 sm:p-6 border border-white/10 transition-colors flex flex-col"
    >
      <article className="flex flex-col h-full">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 line-clamp-3 sm:line-clamp-4">
          {article.title}
        </h2>
        <p className="text-gray-400 mb-4 line-clamp-4 sm:line-clamp-6">
          {article.markdown}
        </p>
        <div className="mt-auto">
          <Link
            href={article.url}
            className="inline-flex items-center text-gray-200 hover:text-blue-800 font-semibold transition-colors group"
          >
            Read more
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ArrowRight className="w-4 h-4 ml-2" />
            </motion.div>
          </Link>
        </div>
      </article>
    </motion.div>
  );
}

function BlogCardSkeleton() {
  return (
    <motion.div
      variants={cardVariants}
      className="bg-white/5 rounded-lg p-4 sm:p-6 border border-white/10 flex flex-col"
    >
      <article className="flex flex-col h-full">
        <Skeleton className="h-7 w-3/4 mb-2" />
        <Skeleton className="h-7 w-1/2 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-6" />
        <div className="mt-auto">
          <Skeleton className="h-4 w-24" />
        </div>
      </article>
    </motion.div>
  );
}

let cachedCustomizations: any = {}; // cache globale in memoria runtime

export function useAccountCustomizations() {
  const [data, setData] = useState<any>(cachedCustomizations);
  const [loading, setLoading] = useState(!Object.keys(cachedCustomizations).length);

  useEffect(() => {
    if (Object.keys(cachedCustomizations).length) return; // già in memoria
    setLoading(true);
    fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/account", {
      credentials: "include",
      cache: "no-cache",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Errore durante la fetch");
        return res.json(); // ✅ converte la risposta in oggetto JS
      })
      .then((data) => {
        cachedCustomizations = data.data
        setData(data.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Errore:", err);
        setLoading(false);
      });

  }, []);

  return { data, loading };
}

/*export function auseAccountCustomizations(defaultStrategy, defaultInstructions) {
  const [strategy, setStrategy] = useState<any>(defaultStrategy || cachedCustomizations.strategy);
  const [instructions, setInstructions] = useState<any>(defaultInstructions || cachedCustomizations.instructions);
  const [loading, setLoading] = useState(!(defaultStrategy || cachedCustomizations.strategy) && (defaultInstructions || cachedCustomizations.instructions));

  useEffect(() => {
    //if (defaultInstructions === undefined) return
    console.log("1", defaultStrategy)
    if ((defaultStrategy !== undefined || cachedCustomizations.strategy) && (defaultInstructions !== undefined || cachedCustomizations.instructions)) return; // già in memoria
    setLoading(true);
    console.log("2", defaultStrategy)
    fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/account", {
      credentials: "include",
      cache: "no-cache",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Errore durante la fetch");
        return res.json(); // ✅ converte la risposta in oggetto JS
      })
      .then((data) => {
        data = data.data
        console.log("3", defaultStrategy, cachedCustomizations.strategy, data.queries)
        if (!defaultStrategy && !cachedCustomizations.strategy) {
          console.log("defaultStrategy", data.queries)
          cachedCustomizations.strategy = data.queries;  // ✅ ora contiene i dati reali
          setStrategy(data.queries);
        }
        if (!defaultInstructions && !cachedCustomizations.instructions) {
          cachedCustomizations.instructions = data.customizations.instructions;  // ✅ ora contiene i dati reali
          setInstructions(data.customizations.instructions);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Errore:", err);
        setLoading(false);
      });

  }, [defaultStrategy, defaultInstructions]);

  return { strategy, instructions, loading };
}*/

const RecruiterProfileCard = ({ data, defaultStrategy, inProgress }: { data: any, defaultStrategy: any, userId: string, companyId: string }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: { queries: strategy } = {}, loading } = useAccountCustomizations();
  const [customStrategy, setCustomStrategy] = useState<any[]>(strategy || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rightStrategy = defaultStrategy !== undefined ? (defaultStrategy || strategy) : strategy
  const handleSetRightStrategy = () => {
    setCustomStrategy(rightStrategy)
  }

  useEffect(() => {
    handleSetRightStrategy()
  }, [strategy, defaultStrategy]);

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const name = data?.recruiter_summary?.name || "Nome Cognome";
  const title = data?.recruiter_summary?.title || "Job Title";
  const location = data?.recruiter_summary?.location?.country || "Location";
  const initials = getInitials(name);

  const handleFind = async () => {
    try {
      setIsSubmitting(true);
      await refindRecruiter(window.location.pathname.split('/').filter(Boolean).pop(), customStrategy, data.recruiter_summary.name, data.recruiter_summary.linkedin_url);

      // la redirect è già gestita dentro la action
    } catch (err) {
      console.error("Errore durante il refindRecruiter:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div variants={itemVariants} className="rounded-lg space-y-4">
      {/* HEADER */}
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

      {/* BUTTON LINKEDIN */}
      {data?.recruiter_summary?.linkedin_url && (
        <motion.div variants={itemVariants}>
          <Link href={`https://${data.recruiter_summary.linkedin_url}`} target="_blank" rel="noopener noreferrer">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="w-full">View on Linkedin</Button>
            </motion.div>
          </Link>
        </motion.div>
      )}

      {/* DIALOG */}
      <motion.div variants={itemVariants}>
        <CreditsDialog unlocked={defaultStrategy !== null} contentType={"find-recruiter"} className="w-full">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-full" variant="outline">Find someone else</Button>
              </motion.div>
            </DialogTrigger>
            {!inProgress && defaultStrategy !== null && <DialogContent className="sm:max-w-4xl w-4xl max-h-screen">
              {isSubmitting && <Overlay />}
              <DialogHeader>
                <DialogTitle>Do you want to search for another recruiter profile?</DialogTitle>
                <DialogDescription>
                  You will be redirected to the onboarding flow to specify new criteria.
                </DialogDescription>
              </DialogHeader>

              {/* Contenuto */}
              {loading ? (
                <p className="text-center text-sm text-gray-500">Loading filters...</p>
              ) : (
                <ScrollArea className="no-scrollbar oveflow-y-auto max-h-[calc(100vh-200px)]">
                  <AdvancedFiltersClient
                    maxStrategies={30}
                    setStrategy={setCustomStrategy}
                    strategy={customStrategy}
                  />
                </ScrollArea>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Close</Button>
                </DialogClose>
                <Button variant="outline" onClick={handleSetRightStrategy}>Reset to default</Button>

                {/* Pulsante con stato di loading */}
                <Button onClick={handleFind} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finding recruiter...
                    </>
                  ) : (
                    "Find the new recruiter with the new criteria"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>}
          </Dialog>
        </CreditsDialog>
      </motion.div>
    </motion.div>
  );
};

const RecruiterSummary = ({ originalData, customStrategy }: { data: any }) => {
  const inProgress = getStepStatus(originalData, "recruiter_summary") !== "completed" || !originalData.recruiter_summary.name
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyId = () => window.location.pathname.split('/').filter(Boolean).pop()!;

  const handleEditRecruiterConfirm = async (urls: string[]) => {
    try {
      setIsSubmitting(true);
      await overrideRecruiterLinkedin(companyId(), urls);
    } catch (err) {
      console.error("Error during overrideRecruiterLinkedin:", err);
      setIsSubmitting(false);
    }
  };

  const [data] = useState(!inProgress ? originalData : {
    recruiter_summary:
      { "name": "Lauren Crabb", "linkedin_url": "#", "experience": [{ "location_names": ["London, England, United Kingdom"], "start_date": "2021-11", "title": { "name": "Senior People Partner (Sales & Technical Services)", "sub_role": "human_resources", "levels": ["senior"], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": true, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png", "name": "Google", "twitter_url": "twitter.com/google", "location": { "name": "Mountain View, California, United States", "postal_code": "94043", "continent": "North America", "street_address": "1600 Amphitheatre Parkway", "region": "California", "metro": "San Jose, California", "country": "United States", "locality": "Mountain View", "geo": "37.39,-122.06", "address_line_2": null }, "linkedin_id": "1441", "industry": "Internet", "founded": 1998, "id": "aKCIYBNF9ey6o5CjHCCO4goHYKlf", "size": "10001+", "facebook_url": "facebook.com/google", "website": "google.com", "linkedin_url": "linkedin.com/company/google" }, "end_date": null }, { "location_names": ["Mountain View, California, United States", "Mexico City, Mexico City, Mexico"], "start_date": "2019-08", "title": { "name": "People Partner (Platforms and Ecosystems)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png", "name": "Google", "twitter_url": "twitter.com/google", "location": { "name": "Mountain View, California, United States", "postal_code": "94043", "continent": "North America", "street_address": "1600 Amphitheatre Parkway", "region": "California", "metro": "San Jose, California", "country": "United States", "locality": "Mountain View", "geo": "37.39,-122.06", "address_line_2": null }, "linkedin_id": "1441", "industry": "Internet", "founded": 1998, "id": "aKCIYBNF9ey6o5CjHCCO4goHYKlf", "size": "10001+", "facebook_url": "facebook.com/google", "website": "google.com", "linkedin_url": "linkedin.com/company/google" }, "end_date": "2021-11" }, { "location_names": ["San Francisco, California, United States"], "start_date": "2019-02", "title": { "name": "Global Human Resources Business Partner (Worldwide Sales & Operations)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQU-0sgMITwNqzwWbNZfDxjhGmmje755YgLHQ&s", "name": "Airbnb", "twitter_url": "twitter.com/airbnb", "location": { "name": "San Francisco, California, United States", "postal_code": "94103", "continent": "North America", "street_address": "888 Brannan Street", "region": "California", "metro": "San Francisco, California", "country": "United States", "locality": "San Francisco", "geo": "37.74,-122.45", "address_line_2": null }, "linkedin_id": "309694", "industry": "Internet", "founded": 2008, "id": "9fGW9Je0KfwfNPtyouflTQneENKN", "size": "5001-10000", "facebook_url": "facebook.com/airbnb", "website": "airbnb.com", "linkedin_url": "linkedin.com/company/airbnb" }, "end_date": "2019-07" }, { "location_names": ["San Francisco, California, United States"], "start_date": "2018-04", "title": { "name": "Human Resources Manager, Global Meraki Bu (Tech + Non-Sales)", "sub_role": "human_resources", "levels": ["manager"], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456", "name": "Cisco Meraki", "twitter_url": "twitter.com/meraki", "location": { "name": "San Francisco, California, United States", "postal_code": "94158", "continent": "North America", "street_address": "500 Terry A. Francois Boulevard", "region": "California", "metro": "San Francisco, California", "country": "United States", "locality": "San Francisco", "geo": "37.74,-122.45", "address_line_2": null }, "linkedin_id": "92950", "industry": "Computer Networking", "founded": 2006, "id": "uXlBn3JswjCAx85kpThCvwWuDLxQ", "size": "1001-5000", "facebook_url": "facebook.com/ciscomeraki", "website": null, "linkedin_url": "linkedin.com/company/cisco-meraki" }, "end_date": "2019-02" }, { "location_names": ["San Francisco, California, United States"], "start_date": "2016-08", "title": { "name": "Human Resources Business Partner (Software / Hardware / Product Mgmt)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://images.ctfassets.net/4cd45et68cgf/Rx83JoRDMkYNlMC9MKzcB/2b14d5a59fc3937afd3f03191e19502d/Netflix-Symbol.png?w=700&h=456", "name": "Cisco Meraki", "twitter_url": "twitter.com/meraki", "location": { "name": "San Francisco, California, United States", "postal_code": "94158", "continent": "North America", "street_address": "500 Terry A. Francois Boulevard", "region": "California", "metro": "San Francisco, California", "country": "United States", "locality": "San Francisco", "geo": "37.74,-122.45", "address_line_2": null }, "linkedin_id": "92950", "industry": "Computer Networking", "founded": 2006, "id": "uXlBn3JswjCAx85kpThCvwWuDLxQ", "size": "1001-5000", "facebook_url": "facebook.com/ciscomeraki", "website": null, "linkedin_url": "linkedin.com/company/cisco-meraki" }, "end_date": "2019-02" }, { "location_names": [], "start_date": "2010-06", "title": { "name": "Human Resources Advisor (Recruitment, Selection Policy and Standards)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1024px-LinkedIn_icon.svg.png", "name": "London Borough of Camden", "twitter_url": "twitter.com/camdentalking", "location": { "name": "London, England, United Kingdom", "postal_code": null, "continent": "Europe", "street_address": "5 Pancras Square", "region": "England", "metro": null, "country": "United Kingdom", "locality": "London", "geo": "51.46,-0.20", "address_line_2": null }, "linkedin_id": "14499", "industry": "Government Administration", "founded": null, "id": "m6QBbKx4WI1XgBnC1R2xXwzz7NFX", "size": "5001-10000", "facebook_url": "facebook.com/grncamden", "website": "camden.gov.uk", "linkedin_url": "linkedin.com/company/london-borough-of-camden" }, "end_date": "2011-05" }, { "location_names": [], "start_date": "2009-07", "title": { "name": "Human Resources Advisor (Employment Initiatives)", "sub_role": "human_resources", "levels": [], "role": "human_resources", "class": "general_and_administrative" }, "is_primary": false, "company": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1024px-LinkedIn_icon.svg.png", "name": "London Borough of Camden", "twitter_url": "twitter.com/camdentalking", "location": { "name": "London, England, United Kingdom", "postal_code": null, "continent": "Europe", "street_address": "5 Pancras Square", "region": "England", "metro": null, "country": "United Kingdom", "locality": "London", "geo": "51.46,-0.20", "address_line_2": null }, "linkedin_id": "14499", "industry": "Government Administration", "founded": null, "id": "m6QBbKx4WI1XgBnC1R2xXwzz7NFX", "size": "5001-10000", "facebook_url": "facebook.com/grncamden", "website": "camden.gov.uk", "linkedin_url": "linkedin.com/company/london-borough-of-camden" }, "end_date": "2010-06" }, { "location_names": [], "start_date": "2007-08", "title": { "name": "Leadership Consultant", "sub_role": null, "levels": [], "role": null, "class": null }, "is_primary": false, "company": { "logo_url": "https://pngdownload.io/wp-content/uploads/2023/12/Apple-Logo-Iconic-Tech-Brand-Symbol-PNG-Transparent-Representation-of-Innovation-and-Design-jpg.webp", "name": "Human Assets LTD", "twitter_url": "twitter.com/humanassetsltd", "location": { "name": "London, England, United Kingdom", "postal_code": null, "continent": "Europe", "street_address": "28 Ulysses Road", "region": "England", "metro": null, "country": "United Kingdom", "locality": "London", "geo": "51.46,-0.20", "address_line_2": null }, "linkedin_id": "1583215", "industry": "Human Resources", "founded": 1987, "id": "u2eo7wIyyEDXgExnUkuXLATKH88O", "size": "1-10", "facebook_url": null, "website": "humanassets.co.uk", "linkedin_url": "linkedin.com/company/human-assets-ltd" }, "end_date": "2009-07" }], "location": { "country": "United Kingdom", "continent": "Europe" }, "skills": ["360 Feedback", "Airflow", "Algebraic Combinatorics", "Algorithms", "C++", "Change Management", "Cheesecakes", "Coaching", "Combinatorics", "Computer Science", "Etl", "Facebook", "Facilitation", "Game Design", "Human Resources", "Mathematical Analysis", "Mathematics", "Matlab", "Microsoft Excel", "Microsoft Office", "Microsoft Word", "Neural Networks", "Organizational Design", , "Powerpoint", "Project Planning", "Psychometrics", "Public Sector", "Public Speaking", "Python", "Recruiting", "Redis", "Research", "Stakeholder Management", "Statistics", "Strategy", "Succession Planning", "Talent Management", "Teaching", ,], "title": "Senior People Partner (Sales & Technical Services)", "education": [{ "minors": [], "start_date": "2006", "degrees": ["Master of Science", "Masters"], "school": { "logo_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtRig-9cUpSg95-hbB_GTx8gySkR8fIq6SvQ&s", "name": "University of Surrey", "domain": "surrey.ac.uk", "location": { "name": "Guildford, England, United Kingdom", "locality": "Guildford", "continent": "Europe", "region": "England", "country": "United Kingdom" }, "linkedin_id": "8369", "type": "post-secondary institution", "id": "PZ-O4dspmqcSoCmg46LW9A_0", "facebook_url": "facebook.com/universityofsurrey", "website": "surrey.ac.uk", "linkedin_url": "linkedin.com/school/university-of-surrey", "twitter_url": "twitter.com/uniofsurrey" }, "gpa": null, "majors": ["Psychology"], "end_date": "2007" }, { "minors": [], "start_date": null, "degrees": ["Bachelor of Science", "Bachelors"], "school": { "logo_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtRig-9cUpSg95-hbB_GTx8gySkR8fIq6SvQ&s", "name": "University of California, Davis", "domain": "ucdavis.edu", "location": { "name": "Davis, California, United States", "locality": "Davis", "continent": "North America", "region": "California", "country": "United States" }, "linkedin_id": "2842", "type": "post-secondary institution", "id": "OBL5pZtjTCqcV0YQ6rpb7Q_0", "facebook_url": "facebook.com/ucdavis", "website": "ucdavis.edu", "linkedin_url": "linkedin.com/school/uc-davis", "twitter_url": "twitter.com/ucdavis" }, "gpa": null, "majors": [], "end_date": "2015" }, { "minors": [], "start_date": null, "degrees": [], "school": { "logo_url": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Stemma_sapienza.png", "name": "University of California", "domain": "universityofcalifornia.edu", "location": { "name": "Oakland, California, United States", "locality": "Oakland", "continent": "North America", "region": "California", "country": "United States" }, "linkedin_id": "2843", "type": "post-secondary institution", "id": "vy-30YJaHfPKMIrQv0hZHg_0", "facebook_url": null, "website": "jobs.universityofcalifornia.edu", "linkedin_url": "linkedin.com/school/university-of-california", "twitter_url": null }, "gpa": null, "majors": [], "end_date": null }] },
    query: { "criteria": [{ "value": ["senior", "manager", "director"], "key": "job_title_levels" }, { "value": ["europe"], "key": "location_continent" }, { "value": [, "Web Applications", , "E-Commerce", , "Project Management", , "Computer Engineering", , "Javascript", , "Python", , "React.js", , "Front End Development", , "Back-End Web Development", , "Web Design", , "Marketing Strategy", , "Product Development", , "SaaS Development", , "Video Game Development", , "Customer Service", , "Teaching", , "Bootstrap"], "key": "skills" }], "name": "Senior Tech Roles with Skills in Target Continent", "id": 21 }
  })

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <Card className="p-4 sm:p-6">
        <h3 className="text-xl sm:text-2xl font-semibold text-white mb-6 flex items-center justify-between">
          <span className="flex items-center">
            <User className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-violet-400" /> Recruiter Summary
          </span>
          {!inProgress && (
            customStrategy !== null
              ? <EditRecruiterLinkedinDialog
                  inProgress={inProgress}
                  isSubmitting={isSubmitting}
                  onConfirm={handleEditRecruiterConfirm}
                />
              : <CreditsDialog unlocked={false} contentType={"find-recruiter"}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" size="sm">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit recruiter
                    </Button>
                  </motion.div>
                </CreditsDialog>
          )}
        </h3>

        <div className={(inProgress ? "bg-gray-800 " : "") + "relative rounded-md"}>
          {inProgress && (
            <Overlay
              content={
                getStepStatus(originalData, "recruiter_summary") === "completed" && (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-16 p-2"
                  >
                    <motion.div
                      variants={itemVariants}
                      className="col-span-1 sm:col-span-4 flex flex-col items-center justify-center text-center py-6 sm:py-10"
                    >
                      <div className="border border-dashed border-gray-700 rounded-2xl p-6 sm:p-10 w-full max-w-xl bg-gray-900/40 backdrop-blur-sm">
                        <p className="text-lg font-semibold text-white mb-3">
                          No Recruiter, Founder, or Employee Found with an email
                        </p>
                        <p className="text-sm text-gray-400 mb-5">
                          We couldn’t identify any relevant profiles for this search.
                          Try adjusting your filters or search criteria.
                        </p>
                        <Separator className="my-5 w-1/2 mx-auto" />
                        <p className="text-xs text-gray-500">
                          If you believe this is an error, please check the source data or contact support.
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                )
              }
            />
          )}

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-16 p-2"
          >
            {/* Left Column */}
            <motion.div variants={itemVariants} className="col-span-1 flex flex-col">
              <RecruiterProfileCard data={data} defaultStrategy={customStrategy} inProgress={inProgress} />
              <Separator className="my-5" />
              <motion.div variants={itemVariants}>
                <p className="text-sm text-gray-400 mb-3">Key Skills</p>
                <SkillsListBase skills={data.recruiter_summary.skills} editable={false} />
              </motion.div>
            </motion.div>

            {/* Right Column */}
            <motion.div variants={itemVariants} className="col-span-1 sm:col-span-3 flex flex-col gap-5">
              <div>
                <p className="text-sm text-gray-400 mb-3">Experience</p>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ExperienceList experience={data.recruiter_summary.experience} />
                </ul>
              </div>
              <Separator className="my-5" />
              <div>
                <p className="text-sm text-gray-400 mb-3">Education</p>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <EducationList education={data.recruiter_summary.education} />
                </ul>
              </div>
            </motion.div>
          </motion.div>

          <div className="p-2">
            <Separator className="my-5" />
            {data.query?.id === 'linkedin_override' ? (
              <p className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                Recruiter specified manually via LinkedIn URL
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-3">
                  {data.recruiter_summary.name} matches this criteria - {data.query?.name}
                </p>
                <CriteriaDisplay criteria={data.query?.criteria} />
              </>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const Overlay = ({ content }: { content?: React.ReactNode }) => {
  return (
    <div className="absolute inset-0 z-50 isolate flex items-center justify-center">
      {/* Layer blur dell'overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-md"></div>

      {/* Contenuto dell'overlay sopra il blur */}
      {content || <div className="relative flex flex-col items-center justify-center space-y-4">
        <span className="text-white text-xl font-semibold animate-pulse">In progress…</span>
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>}
    </div>
  )
}

export function EmailAttachmentDragger({ fileUrl, fileName }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = async (e) => {
    try {
      // Recupera il file reale dal server (es. PDF su Unica)
      const response = await fetch(fileUrl);
      const blob = await response.blob();

      // Crea un oggetto temporaneo per il drag
      const objectUrl = URL.createObjectURL(blob);
      console.log(objectUrl, blob)
      // Imposta i metadati di drag-and-drop riconosciuti da macOS Mail e alcuni browser
      e.dataTransfer.setData("DownloadURL", `${blob.type}:${fileName}:${objectUrl}`);
      e.dataTransfer.effectAllowed = "copy";
    } catch (error) {
      console.error("Errore durante il fetch del file:", error);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDragEnd={() => setIsDragging(false)}
      className={`p-6 text-center border-2 border-dashed rounded-2xl transition select-none cursor-grab ${isDragging ? "bg-blue-100 border-blue-500" : "border-gray-300 hover:border-gray-400"
        }`}
    >
      📎 Trascina da qui per allegare <br />
      <span className="font-medium">{fileName}</span>
      <p className="text-sm text-gray-500 mt-2">(funziona su Apple Mail, Outlook, alcuni client Gmail)</p>
    </div>
  );
}

interface EmailData {
  email?: {
    email_address: string;
  };
  subject?: string;
  body?: string;
  attachmentUrl?: string;
}

interface Props {
  data: EmailData;
}

interface CachedFile {
  base64: string;
  mimeType: string;
  timestamp: number; // per eventuale scadenza
}

export function EmailDialog({
  from,
  to,
  subject,
  body,
  attachmentUrl,
  attachmentName = "cv.pdf",
  buttonLabel = "Send email",
}) {
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const CACHE_PREFIX = "cachedEmailFiles";
  const CACHE_TTL = 2592000000; // 30 giorni

  const fetchFile = async () => {
    if (!attachmentUrl) return;

    const cachedStorage = localStorage.getItem(CACHE_PREFIX);
    let cache: Record<string, CachedFile> = cachedStorage ? JSON.parse(cachedStorage) : {};
    const cachedFile = cache[attachmentUrl];

    const now = Date.now();
    if (cachedFile && now - cachedFile.timestamp < CACHE_TTL) {
      setFileData({ base64: cachedFile.base64, mimeType: cachedFile.mimeType });
      return cachedFile;
    }

    const result = await getFileFromFirebase(attachmentUrl);
    const newCacheFile: CachedFile = { ...result, timestamp: now };

    cache[attachmentUrl] = newCacheFile;
    localStorage.setItem(CACHE_PREFIX, JSON.stringify(cache));

    setFileData(result);
    return result;
  };

  const handleDragStart = async (e: React.DragEvent<HTMLDivElement>) => {
    let file = fileData;
    if (!file) {
      file = await fetchFile();
      if (!file) return;
    }

    const blob = b64toBlob(file.base64, file.mimeType);
    const url = URL.createObjectURL(blob);

    e.dataTransfer.setData(
      "DownloadURL",
      `${file.mimeType}:${attachmentName}:${url}`
    );

    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
  };

  const b64toBlob = (b64Data: string, contentType = "", sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      await submitEmailSent(window.location.pathname.split("/").filter(Boolean).pop(), true);
      track({ name: "email_send", params: { company_name: to ?? "unknown" } });
      setSuccess(true);
    } catch (err) {
      console.error("Error submitting email:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(
    subject || ""
  )}&body=${encodeURIComponent(body || "")}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Link href={mailtoLink}>
          <Button className="w-full">{buttonLabel}</Button>
        </Link>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach Your CV</DialogTitle>
          <DialogDescription>
            Drag this file into your email client to quickly attach your CV.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            draggable
            onDragStart={handleDragStart}
            className="cursor-grab flex flex-col items-center gap-2"
          >
            <FileText size={48} className="text-blue-600" />
            <span>Drag me into your email</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>

          <Button
            variant="outline"
            onClick={async () => {
              let file = fileData;
              if (!file) file = await fetchFile();
              if (!file) return;
              const blob = b64toBlob(file.base64, file.mimeType);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = attachmentName;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download CV
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? "Sending..."
              : success
                ? "Email sent ✓"
                : "Email Sent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailDraftButton({
  from,
  to,
  subject,
  body,
  attachmentUrl,
  attachmentName = "cv.pdf",
  buttonLabel = "Send email",
}) {
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState(null);

  const handleClick = () => {
    startTransition(async () => {
      setError(null);
      try {
        // 1️⃣ Recupera file dal server (Firebase Admin)
        const result = await getFileFromFirebase(attachmentUrl);
        const { base64, mimeType } = result;

        // 2️⃣ Crea contenuto EML
        const boundary = "----=_NextPart_000_0000_01D00000.00000000";
        const emlContent = [
          `From: ${from}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          "MIME-Version: 1.0",
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          "Content-Type: text/plain; charset=UTF-8",
          "",
          body,
          "\n",
          `--${boundary}`,
          `Content-Type: ${mimeType}; name="${attachmentName}"`,
          `Content-Disposition: attachment; filename="${attachmentName}"`,
          "Content-Transfer-Encoding: base64",
          "",
          base64,
          "",
          `--${boundary}--`,
        ].join("\r\n");

        // 3️⃣ Crea Blob e forza il download
        const blob = new Blob([emlContent], { type: "message/rfc822" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bozza-email.eml";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        setError("Errore nella generazione della bozza email");
      }
    });
  };

  return (
    <Button className="w-full"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Creating..." : buttonLabel}
    </Button>
  );
}

export const CreditsDialog = ({ children, contentType, unlocked, className = "", action, number = 1, email = "" }: { children: any, contentType: any, unlocked: any, className?: string, action?: () => Promise<any>, number?: number, email?: string }) => {
  const requiredCredits = (creditsInfo[contentType]?.cost || 0) * number;
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [selectedCreditPackageId, setSelectedCreditPackageId] = useState("pkg_1000");

  const handleUnlock = async () => {
    setIsUnlocking(true);
    setError(null);

    const companyId = window.location.pathname.split("/").filter(Boolean).pop();
    const result = action === undefined ? await payCredits(companyId, contentType) : await action?.()

    if (!result.success) {
      setError(result.error);
      setIsUnlocking(false);
      return;
    }

    track({ name: "credits_used", params: { action: contentType, cost: requiredCredits, remaining: result.credits ?? 0 } });
    if (contentType === "find-recruiter") {
      const companyName = document.querySelector<HTMLElement>("[data-company-name]")?.dataset.companyName ?? companyId ?? "unknown";
      track({ name: "recruiter_find", params: { company_name: companyName, cost: requiredCredits } });
    }
  };

  return (
    <>
    <Dialog>
      <DialogTrigger className={className} onClick={() => unlocked ? action?.() : null}>{children}</DialogTrigger>
      {!unlocked && (
        <DialogContent>
          <div className="flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl shadow-2xl border border-purple-500/20 overflow-hidden animate-in zoom-in-95 duration-200">

              {/* Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700" />
              </div>

              <div className="relative p-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse" />
                    <div className="relative bg-gradient-to-br from-purple-500 to-blue-500 rounded-full p-5 transition-all duration-500">
                      <Lock className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-white mb-3">
                  Premium Content
                </h2>

                <p className="text-center text-slate-300 mb-8">
                  {creditsInfo[contentType]?.description || <>Unlock this {contentType} to access exclusive features</>}
                </p>

                {/* Credits card */}
                <div className="bg-slate-800/50  rounded-xl p-6 mb-6 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-400 text-sm font-medium">
                      Credits required
                    </span>
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        {requiredCredits}
                      </span>
                    </div>
                  </div>

                  {/* Animated progress bar */}
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`
                        h-full rounded-full 
                        bg-gradient-to-r from-purple-500 to-blue-500 
                        transition-all duration-[1500ms] ease-in-out
                        ${isUnlocking ? 'w-full animate-pulse' : 'w-0'}
                      `}
                    />
                  </div>
                </div>


                {/* Error states */}
                {error === "Insufficient credits" && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-center rounded-xl p-4 mb-4 flex flex-col items-center gap-3 animate-in fade-in duration-200">
                    <XCircle className="w-6 h-6" />
                    <p>You don’t have enough credits to unlock this content.</p>
                    <Button
                      onClick={() => setBuyCreditsOpen(true)}
                      className="mt-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold"
                    >
                      Buy more credits
                    </Button>
                  </div>
                )}

                {error && error !== "Insufficient credits" && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-center rounded-xl p-4 mb-4 animate-in fade-in duration-200">
                    {error}
                  </div>
                )}

                {/* Unlock button */}
                {!error && (
                  <button
                    onClick={handleUnlock}
                    disabled={isUnlocking}
                    className={`
                      w-full py-4 px-6 rounded-xl font-semibold text-white
                      transition-all duration-300 transform
                      bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                      flex items-center justify-center gap-2 relative overflow-hidden
                    `}
                  >
                    {isUnlocking ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Unlocking...</span>
                      </>
                    ) : (
                      <>
                        <span>Unlock for {requiredCredits} credits</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                )}

                {/* Cancel */}
                <DialogClose asChild>
                  <button
                    disabled={isUnlocking}
                    className="w-full mt-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Maybe later
                  </button>
                </DialogClose>
              </div>

              {/* Decorations */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-tr-full" />
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>

    <Dialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
          <DialogDescription>Select a credit package and complete your purchase instantly.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <CreditSelector
            onSelect={(pkg) => setSelectedCreditPackageId(pkg.id)}
            selectedId={selectedCreditPackageId}
          />
          <UnifiedCheckout
            purchaseType="credits"
            itemId={selectedCreditPackageId}
            email={email}
            onSuccess={() => setBuyCreditsOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export const EmailGenerated = ({ data, defaultInstructions }: { data: any; defaultInstructions: string; emailSent: boolean }) => {
  const inProgress = !data?.email;
  const placeholderEmail = {
    body: `Lorem ipsum dolor sit amet...`,
    subject: "AI/ML Innovations at Google & Shared Passion for Scalable Solutions",
    key_points: ["Point 1...", "Point 2...", "Point 3..."],
  };

  const companyId = typeof window !== "undefined"
    ? window.location.pathname.split("/").filter(Boolean).pop() ?? ""
    : "";

  const [emailHistory, setEmailHistory] = useState<any[]>([]);

  const { data: { customizations: { instructions } = {} } = {}, loading } = useAccountCustomizations();
  const [customInstructions, setCustomInstructions] = useState(defaultInstructions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false); // ✅ stato di caricamento per Email Sent
  const [email, setEmail] = useState(data.email || {});
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const isEmailSent = (ts: any) => ts?._seconds > 0;

  const viewedEmail = selectedHistoryIndex !== null ? emailHistory[selectedHistoryIndex] : email;
  const isViewingHistory = selectedHistoryIndex !== null;

  const rightInstructions = defaultInstructions !== undefined ? (defaultInstructions || instructions) : instructions
  const handleSetRightInstructions = () => {
    setCustomInstructions(rightInstructions)
  }

  useEffect(() => {
    handleSetRightInstructions()
  }, [instructions, defaultInstructions]);

  useEffect(() => {
    setEmail(data.email || {});
    setEmailSentSuccess(false)
    setIsEmailSubmitting(false)
    setSelectedHistoryIndex(null)
  }, [data]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/protected/email-history/${companyId}`)
      .then(r => r.json())
      .then(res => { if (res.success) setEmailHistory(res.versions || []); })
      .catch(() => {});
  }, [companyId]);

  const handleGenerate = async () => {
    try {
      setIsSubmitting(true);
      await regenerateEmail(window.location.pathname.split("/").filter(Boolean).pop(), customInstructions);
      // la redirect è già gestita dentro la action
    } catch (err) {
      console.error("Errore durante il refindRecruiter:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSent = async () => {
    try {
      setIsEmailSubmitting(true);

      await submitEmailSent(window.location.pathname.split("/").filter(Boolean).pop(), false);

      setEmailSentSuccess(true);
    } catch (err) {
      console.error("Errore durante l’invio:", err);
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleUpdateEmail = async () => {
    try {
      setIsEmailSubmitting(true);

      await submitUpdateEmail(window.location.pathname.split("/").filter(Boolean).pop(), email.subject !== data.email.subject ? email.subject : null, email.body !== data.email.body ? email.body : null);

      setEmailSentSuccess(true);
    } catch (err) {
      console.error("Errore durante l’invio:", err);
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Pulizia
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleSwitchVersion = async (historyIndex: number) => {
    try {
      setIsSubmitting(true);
      await switchEmailVersion(companyId, historyIndex);
    } catch (err) {
      console.error("Errore durante il cambio versione:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayEmail = inProgress ? placeholderEmail : viewedEmail;

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-xl sm:text-2xl font-semibold text-white flex items-center">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-violet-400" /> Email Generated
          </h3>

          {/* Version selector */}
          {emailHistory.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <button
                onClick={() => setSelectedHistoryIndex(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !isViewingHistory
                    ? "bg-violet-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Current
              </button>
              {emailHistory.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedHistoryIndex(i)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedHistoryIndex === i
                      ? "bg-violet-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  v{emailHistory.length - i}
                </button>
              ))}
            </div>
          )}
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={`${inProgress ? "bg-gray-900 " : ""} rounded-md relative grid grid-cols-1 sm:grid-cols-5 gap-4`}
        >
          {inProgress && <Overlay />}

          {/* Colonna principale con input */}
          <div className="col-span-1 sm:col-span-4 space-y-3">
            <motion.div variants={itemVariants}>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Subject</label>
              <Input
                value={displayEmail?.subject}
                onChange={(e) => !isViewingHistory && setEmail((prev) => ({ ...prev, subject: e.target.value }))}
                disabled={inProgress || isViewingHistory || isEmailSent(email.email_sent)}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Body</label>
              <Textarea
                rows={12}
                value={displayEmail?.body}
                onChange={(e) => !isViewingHistory && setEmail((prev) => ({ ...prev, body: e.target.value }))}
                disabled={inProgress || isViewingHistory || isEmailSent(email.email_sent)}
              />
            </motion.div>

            <Separator />

            <motion.div variants={itemVariants} className="w-full flex flex-wrap justify-end gap-3">
              {!isViewingHistory && (
                <CreditsDialog unlocked={email.prompt} contentType="prompt">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">View Prompt</Button>
                    </DialogTrigger>
                    {!inProgress && email.prompt && (
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Prompt used for the email</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="no-scrollbar overflow-y-auto max-h-[calc(100vh-200px)] w-full">
                          <div className="w-full max-w-md">
                            {email.prompt.split(/\n/).map((line, i) =>
                              line.trim() === "" ? <br key={i} /> : <p key={i}>{line}</p>
                            )}
                          </div>
                        </ScrollArea>
                        <DialogFooter>
                          <Button variant="outline" icon={<Download />} onClick={() => downloadTextFile("prompt", email.prompt)}>Download</Button>
                          <Button variant="outline" icon={<Copy />} onClick={() => { navigator.clipboard.writeText(email.prompt); track({ name: "email_copy", params: { company_name: "prompt" } }); }}>Copy</Button>
                        </DialogFooter>
                      </DialogContent>
                    )}
                  </Dialog>
                </CreditsDialog>
              )}

              {!isViewingHistory && data.email && (email.body !== data.email.body || email.subject !== data.email.subject) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEmail(data.email || {})} disabled={isEmailSubmitting}>Reset to default</Button>
                  <Button size="sm" onClick={() => handleUpdateEmail()} disabled={isEmailSubmitting}>Update</Button>
                </>
              )}

              {isViewingHistory && (
                <Button
                  size="sm"
                  onClick={() => handleSwitchVersion(selectedHistoryIndex!)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</> : "Use this version"}
                </Button>
              )}
            </motion.div>
          </div>

          {/* Colonna laterale */}
          <motion.div variants={itemVariants} className="col-span-1 space-y-4 mt-4 sm:mt-0">
            {!isViewingHistory && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {!isEmailSent(email.email_sent) ? (
                  <EmailDialog
                    to={email?.email_address}
                    from={"ifralex.business@gmail.com"}
                    subject={email?.subject}
                    body={email?.body}
                    attachmentUrl={email?.cv_url}
                  />
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    icon={isEmailSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Check color="green" />}
                    onClick={handleEmailSent}
                    disabled={isEmailSubmitting || emailSentSuccess}
                  >
                    {isEmailSubmitting ? "Sending..." : emailSentSuccess ? "Email sent ✓" : "Email Sent"}
                  </Button>
                )}
              </motion.div>
            )}

            {/* Dialog per rigenerare email */}
            {!isViewingHistory && (
              <CreditsDialog contentType="generate-email" unlocked={defaultInstructions !== null} className="w-full">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" disabled={loading}>Generate another</Button>
                  </DialogTrigger>
                  {defaultInstructions !== null && (
                    <DialogContent className="sm:max-w-4xl w-full max-h-screen">
                      {isSubmitting && <Overlay />}
                      <DialogHeader>
                        <DialogTitle className="flex">Define Custom Instructions</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="no-scrollbar oveflow-y-automax-h-[calc(100vh-200px)]">
                        <div className="p-1">
                          <Textarea rows={5} value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} />
                        </div>
                      </ScrollArea>
                      <DialogFooter className="flex flex-wrap gap-2 justify-end">
                        <DialogClose>
                          <Button variant="ghost">Close</Button>
                        </DialogClose>
                        <Button variant="outline" onClick={handleSetRightInstructions} disabled={customInstructions === rightInstructions}>
                          Reset to default
                        </Button>
                        <Button onClick={handleGenerate} disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating email...
                            </>
                          ) : (
                            "Generate the new email with the new instructions"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  )}
                </Dialog>
              </CreditsDialog>
            )}

            {/* Key points */}
            <div className="p-4 font-sans">
              <h2 className="text-2xl font-semibold mb-4">Email perfect because:</h2>
              <motion.ul variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {displayEmail?.key_points?.map((item: string, i: number) => (
                  <motion.li key={i} variants={itemVariants} className="flex items-center">
                    <Check className="text-green-500 mr-2 min-w-5 h-5" size={5} />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            {/* Email address (storico) */}
            {isViewingHistory && viewedEmail?.email_address && (
              <div className="p-3 bg-gray-800 rounded-md">
                <p className="text-xs text-gray-400 mb-1">Email address</p>
                <p className="text-sm text-white break-all">{viewedEmail.email_address}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </Card>
    </motion.div>
  );
};

const EditRecruiterLinkedinDialog = ({
  inProgress,
  isSubmitting,
  onConfirm,
}: {
  inProgress: boolean;
  isSubmitting: boolean;
  onConfirm: (urls: string[]) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [urlList, setUrlList] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (!v) setUrlList([]);
    setNewUrl("");
    setOpen(v);
  };

  const removeUrl = (idx: number) => setUrlList(prev => prev.filter((_, i) => i !== idx));

  const addUrl = () => {
    const url = newUrl.trim();
    if (!url || urlList.includes(url)) return;
    setUrlList(prev => [...prev, url]);
    setNewUrl("");
  };

  const handleConfirm = async () => {
    await onConfirm(urlList);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={inProgress}>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="outline" size="sm" disabled={inProgress}>
            <Pencil className="w-3 h-3 mr-1" />
            Edit recruiter
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {isSubmitting && <Overlay />}
        <DialogHeader>
          <DialogTitle>Override recruiter via LinkedIn</DialogTitle>
          <DialogDescription>
            Add LinkedIn profile URLs in priority order. The first profile found will be used as the recruiter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {urlList.map((url, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-2">
              <span className="text-xs text-gray-500 shrink-0 w-5">{i + 1}.</span>
              <p className="text-sm text-white truncate flex-1">{url}</p>
              <button
                onClick={() => removeUrl(i)}
                className="shrink-0 text-gray-400 hover:text-red-400 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
          {urlList.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No LinkedIn URLs added.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addUrl()}
            placeholder="https://linkedin.com/in/..."
            className="flex-1"
          />
          <Button onClick={addUrl} disabled={!newUrl.trim()} size="sm">
            Add
          </Button>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={isSubmitting || urlList.length === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditArticlesDialog = ({
  articles,
  inProgress,
  isSubmitting,
  onConfirm,
}: {
  articles: Array<{ url: string; title: string; markdown: string }>;
  inProgress: boolean;
  isSubmitting: boolean;
  onConfirm: (articles: Array<{ url: string; title: string; markdown: string }>) => Promise<void>;
}) => {
  const MAX = 10;
  const [open, setOpen] = useState(false);
  const [editedList, setEditedList] = useState<Array<{ url: string; title: string; markdown: string }>>([]);
  const [newUrl, setNewUrl] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (v) setEditedList(articles.map(a => ({ url: a.url, title: a.title || "", markdown: a.markdown || "" })));
    setNewUrl("");
    setOpen(v);
  };

  const removeArticle = (idx: number) => setEditedList(prev => prev.filter((_, i) => i !== idx));

  const addUrl = () => {
    const url = newUrl.trim();
    if (!url || editedList.length >= MAX || editedList.some(a => a.url === url)) return;
    setEditedList(prev => [...prev, { url, title: "", markdown: "" }]);
    setNewUrl("");
  };

  const originalUrls = articles.map(a => a.url).sort().join(",");
  const currentUrls = editedList.map(a => a.url).sort().join(",");
  const hasChanges = originalUrls !== currentUrls;

  const handleConfirm = async () => {
    await onConfirm(editedList);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={inProgress}>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="outline" size="sm" disabled={inProgress}>
            <Pencil className="w-3 h-3 mr-1" />
            Edit articles
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {isSubmitting && <Overlay />}
        <DialogHeader>
          <DialogTitle>Edit blog articles</DialogTitle>
          <DialogDescription>
            Remove existing articles or add new ones by URL. Max {MAX} articles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {editedList.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{a.title || a.url}</p>
                {a.title && <p className="text-xs text-gray-500 truncate">{a.url}</p>}
              </div>
              <button
                onClick={() => removeArticle(i)}
                className="shrink-0 text-gray-400 hover:text-red-400 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
          {editedList.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No articles added.</p>
          )}
        </div>

        {editedList.length === 0 && hasChanges && (
          <p className="text-xs text-yellow-500">
            No articles selected, the email will be generated without any blog content.
          </p>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addUrl()}
            placeholder="https://..."
            className="flex-1"
            disabled={editedList.length >= MAX}
          />
          <Button onClick={addUrl} disabled={!newUrl.trim() || editedList.length >= MAX} size="sm">
            Add
          </Button>
        </div>
        <p className="text-xs text-gray-500 text-right">{editedList.length}/{MAX} articles</p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BlogPostsSection = ({ data, blogSearchUnlocked }: { data: any, blogSearchUnlocked: boolean }) => {
  const inProgress = getStepStatus(data, "blog_articles") !== "completed"
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyId = () => window.location.pathname.split('/').filter(Boolean).pop()!;

  const handleEditConfirm = async (editedArticles: Array<{ url: string; title: string; markdown: string }>) => {
    try {
      setIsSubmitting(true);
      await updateBlogArticles(companyId(), editedArticles);
    } catch (err) {
      console.error("Error during updateBlogArticles:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <Card className="p-4 sm:p-6">
        <h3 className="text-xl sm:text-2xl font-semibold text-white mb-6 flex items-center justify-between">
          <span className="flex items-center">
            <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-violet-400" /> Blog Articles Selected
          </span>
          {!inProgress && (
            blogSearchUnlocked
              ? <EditArticlesDialog
                  articles={(data.blog_articles?.content as Array<{ url: string; title: string; markdown: string }>) ?? []}
                  inProgress={inProgress}
                  isSubmitting={isSubmitting}
                  onConfirm={handleEditConfirm}
                />
              : <CreditsDialog unlocked={false} contentType={"research-blog-articles"}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" size="sm">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit articles
                    </Button>
                  </motion.div>
                </CreditsDialog>
          )}
        </h3>

        <div className={(inProgress ? "bg-gray-900 " : "") + "relative rounded-md"}>
          {inProgress && <Overlay />}

          {/* BLOG CARDS */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {inProgress
              ? Array.from({ length: 3 }).map((_, i) => <BlogCard key={i} />)
              : data.blog_articles.content.map((article) =>
                  article.pending_content
                    ? <BlogCardSkeleton key={article.url} />
                    : <BlogCard key={article.url} article={article} />
                )}
          </motion.div>

          <Separator className="my-5" />

          {/* STATS */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-5"
          >
            {[
              {
                label: "Posts found",
                value: data.blog_articles?.articles_found || 0,
                icon: Search,
                color: "blue",
              },
              {
                label: "Posts Deeply Analyzed",
                value: data.blog_articles?.content.length || 0,
                icon: Brain,
                color: "blue",
              },
              {
                label: "Blogs found",
                value: data.blog_articles?.blogs_analized || 0,
                icon: CheckCircle2,
                color: "blue",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={statsVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <Card className="p-4 sm:p-6 backdrop-blur-none">
                  <div className="flex items-center justify-between">
                    {/* TEXT */}
                    <div>
                      <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 + 0.3 }}
                        className="text-2xl sm:text-3xl font-bold text-white"
                      >
                        {stat.value}
                      </motion.p>
                    </div>

                    {/* ICON */}
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 bg-${stat.color}-500/20 rounded-xl flex items-center justify-center`}
                    >
                      <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${stat.color}-400`} />
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
const COMPANY_DETAIL_STEPS = [
  {
    title: 'Company Detail Page',
    description: 'Here you can see everything about this company: the recruiter we found, culture insights from their blog, and your personalized outreach email.',
  },
  {
    targetId: 'company-header',
    title: 'Campaign Status',
    description: 'This header shows the company info, processing progress, and which steps (recruiter search, culture analysis, email generation) have been completed.',
  },
  {
    targetId: 'email-section',
    title: 'Your Personalized Email',
    description: 'This is the email generated specifically for this company and recruiter. Review it, edit if needed, then copy or send it directly.',
  },
  {
    targetId: 'recruiter-section',
    title: 'Recruiter Profile',
    description: 'We identified the recruiter most likely to champion your application, complete with their experience, skills, and contact info.',
  },
  {
    targetId: 'blog-section',
    title: 'Company Culture Analysis',
    description: 'We analyzed recent articles and news about the company to tailor your email to their culture, values, and current priorities.',
  },
];

// Questo è il componente principale che assembla tutte le parti animate
// e riceve i dati dal componente Server.
export default function ResultClient({ data, customizations, emailSent }: { data: any; customizations: any; emailSent: any }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-16"
    >
      <CompanyDetailTutorialTrigger />
      <div data-tutorial="company-header">
        <CompanyHeader data={data} />
      </div>
      <div data-tutorial="email-section">
        <EmailGenerated data={data} defaultInstructions={customizations.instructions} emailSent={emailSent} />
      </div>
      <div data-tutorial="recruiter-section">
        <RecruiterSummary originalData={data} customStrategy={customizations.queries} />
      </div>
      <div data-tutorial="blog-section">
        <BlogPostsSection data={data} blogSearchUnlocked={customizations.blogSearch !== null} />
      </div>
      {data.company_info && <CompanyCard company={data.company_info} />}
    </motion.div>
  );
}

function CompanyDetailTutorialTrigger() {
  const { isPageCompleted, startTutorial, isActive } = useTutorialHook();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || isActive) return;
    if (isPageCompleted('company_detail')) return;
    const t = setTimeout(() => {
      started.current = true;
      startTutorial('company_detail', COMPANY_DETAIL_STEPS);
    }, 700);
    return () => clearTimeout(t);
  }, [isPageCompleted, startTutorial, isActive]);
  return null;
}

import React from "react"
import { Globe, MapPin, Calendar, Users, Building2, TrendingUp, Sparkles, Zap, Target, Shield, Link2, Award, BarChart3, Layers } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFileFromFirebase, overrideRecruiterLinkedin, payCredits, refindRecruiter, regenerateEmail, startServer, submitEmailSent, submitUpdateEmail, switchEmailVersion, updateBlogArticles } from "@/actions/onboarding-actions";
import { creditsInfo } from "@/config";

const formatNumber = (num) => {
  if (!num) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatCurrency = (amount) => {
  if (!amount) return 'N/A';
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount}`;
};

const CompanyCard = ({ company }) => {
  
};

const StatCard = ({ icon, label, value, subtitle, color, delay }) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-400/30 text-blue-300',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-400/30 text-purple-300',
    emerald: 'from-emerald-500/20 to-emerald-600/20 border-emerald-400/30 text-emerald-300',
    amber: 'from-amber-500/20 to-amber-600/20 border-amber-400/30 text-amber-300',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-400/30 text-pink-300',
    indigo: 'from-indigo-500/20 to-indigo-600/20 border-indigo-400/30 text-indigo-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm rounded-xl p-4 border relative overflow-hidden group`}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        initial={false}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">
            {label}
          </div>
        </div>
        <div className="text-xl font-bold text-white truncate">
          {value}
        </div>
        {subtitle && (
          <div className="text-xs opacity-70 mt-1 truncate">
            {subtitle}
          </div>
        )}
      </div>
    </motion.div>
  );
};
