import OnboardingPage from "../../components/onboardingServer";
import { cookies } from "next/headers";
import { Suspense } from "react";

export const metadata = { title: "Dashboard" };
import { Results, ResultsSkeleton, CampaignSkeleton } from "@/components/dashboardServer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle, Crown, ExternalLink, Mail, Plus, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { AnimatedResults, AddMoreCompaniesDialog, ConfirmCompanies } from "@/components/dashboard";
import { DashboardTracker } from "@/components/DashboardTracker";
import { calculateProgress } from "@/components/detailsServer";
import Link from "next/link";
import { TutorialTrigger } from "@/components/TutorialTrigger";

const DASHBOARD_STEPS = [
    {
        title: 'Welcome to CandidAI! 👋',
        description: 'This is your control center for all job application campaigns. Let\'s take a quick tour of the main features.',
    },
    {
        targetId: 'nav-dashboard',
        title: 'Dashboard',
        description: 'This is the main dashboard. Click here anytime to come back and see all your active campaigns.',
    },
    {
        targetId: 'nav-send-all',
        title: 'Send All',
        description: 'Send emails to all companies that are ready with a single click — no need to open each one individually.',
    },
    {
        targetId: 'nav-follow-ups',
        title: 'Follow Ups (Coming Soon)',
        description: 'Automated follow-up emails will be sent on your behalf to companies that haven\'t responded yet.',
    },
    {
        targetId: 'nav-credits',
        title: 'Plan & Credits',
        description: 'Manage your subscription plan, buy extra credits, and unlock advanced features like custom instructions.',
    },
    {
        targetId: 'nav-support',
        title: 'Support',
        description: 'Find guides, FAQs, and tips to get the most out of CandidAI.',
    },
    {
        targetId: 'nav-settings',
        title: 'Settings',
        description: 'Configure notification preferences, email frequency, and other account settings.',
    },
    {
        targetId: 'stats-cards',
        title: 'Campaign Stats',
        description: 'These cards show you at a glance how many companies are being processed, ready to send, already sent, and how many articles were analyzed.',
    },
    {
        targetId: 'campaign-cards',
        title: 'Your Campaigns',
        description: 'Each card is a company you\'re targeting. Click any card to view the recruiter profile, culture analysis, and the personalized email we generated.',
    },
    {
        targetId: 'add-companies',
        title: 'Add More Companies',
        description: 'You can add more companies to your campaign at any time, up to the limit of your current plan.',
    },
];

const DashboardSkeleton = () => (
    <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-12" />
                        </div>
                        <Skeleton className="w-12 h-12 rounded-xl" />
                    </div>
                </div>
            ))}
        </div>

        {/* Active Campaigns Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-36" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <CampaignSkeleton key={i} />
                ))}
            </div>
        </div>
    </>
);

function Card({ children, className, hover = true, gradient = false, ...props }: CardProps) {
    const baseClasses = "bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl transition-all duration-300"
    const hoverClasses = hover ? "hover:bg-white/10 hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-500/20" : ""
    const gradientClasses = gradient ? "bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30" : ""

    return (
        <div
            data-slot="card"
            className={cn(baseClasses, hoverClasses, gradientClasses, className)}
            {...props}
        >
            {children}
        </div>
    )
}

async function ResultsWrapper({ userId, plan, maxCompanies, companiesUsed }: { userId: string; plan: string; maxCompanies?: number; companiesUsed?: number }) {
    const isEpochTs = (ts: any) => ts?._seconds === 0;
    const isSentTs = (ts: any) => ts?._seconds > 0;

    const parseResults = (results) => {
        const { companies_to_confirm: _, ...rest } = results
        return Object.entries(rest)
            .filter(([, info]: any) => !isSentTs(info?.email_sent))
            .map(([id, info]) => {
            // valori sicuri
            const recruiterName = info?.recruiter?.name ?? null;
            const recruiterTitle = info?.recruiter?.job_title ?? null;
            const startDate = info?.start_date ? new Date(info?.start_date._seconds * 1000 + info?.start_date._nanoseconds / 1e6) : null;
            const company = info?.company ?? null;

            // calcola estimatedCompletion = start_date + 2 giorni (se start_date presente)
            let estimatedCompletion = null;
            if (startDate) {
                const d = new Date(startDate.getTime());
                if (!isNaN(d)) {
                    d.setDate(d.getDate() + 2);
                    estimatedCompletion = d.toISOString().split('T')[0]; // yyyy-mm-dd
                }
            }

            // progress: logica semplice e personalizzabile
            // - blog_post_analyzed true => +60
            // - email_sent true => +40
            // (puoi cambiare i pesi a piacere)
            const recruiterFound = info?.recruiter !== undefined;
            const blogDone = info?.blog_articles;
            const emailDone = info?.email_sent !== undefined;
            const emailSent = info?.email_sent;
            let progress = calculateProgress(info)

            const status = progress === 100 ? 'completed' : 'processing';

            // stage coerente con i booleani (ordine logico)
            let stage = 'Finding recruiter';
            if (emailDone) stage = 'Email generated';
            else if (blogDone) stage = 'Generating email';
            else if (recruiterFound) stage = 'Analyzing company culture';

            // emailsGenerated come come numero (1 se true, 0 altrimenti)
            const emailsGenerated = emailDone ? 1 : 0;

            return {
                id,
                company,
                status,
                progress,
                recruiterName,
                recruiterTitle,
                startDate,
                estimatedCompletion,
                emailsGenerated,
                stage
            };
        });
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/results`, {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const companiesToConfirm = data.data.companies_to_confirm
    const parsedResults = parseResults(data.data || {}).filter(i => !(companiesToConfirm || []).includes(i.id));
    const { companies_to_confirm: _ctc, ...campaignEntries } = data.data;
    const campaignValues = Object.values(campaignEntries);
    const processingCampaigns = campaignValues
        .filter(obj => !("email_sent" in obj))
        .length;
    const readyCampaigns = campaignValues
        .filter((obj: any) => isEpochTs(obj?.email_sent))
        .length;
    const sentCampaigns = campaignValues
        .filter((obj: any) => isSentTs(obj?.email_sent))
        .length;
    const articlesFound = campaignValues
        .reduce((sum: number, obj: any) => sum + (obj.blog_articles || 0), 0);

    return <>
        <DashboardTracker campaignCount={campaignValues.length} plan={plan} />
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tutorial="stats-cards">
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
                        <p className="text-gray-400 text-sm mb-1">Articles Found</p>
                        <p className="text-2xl font-bold text-white">{articlesFound}</p>
                    </div>
                    <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                        <Mail className="w-6 h-6 text-violet-400" />
                    </div>
                </div>
            </Card>
        </div>

        {companiesToConfirm && companiesToConfirm.length > 0 && <Card className="p-8 backdrop-blur-none">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Companies To Be Confirmed</h2>
                <Badge variant="primary">{companiesToConfirm.length} total</Badge>
            </div>

            <Suspense fallback={<ResultsSkeleton />}>
                <ConfirmCompaniesWrapper userId={userId} companiesToConfirm={companiesToConfirm} />
            </Suspense>
        </Card>}

        {/* Active Campaigns */}
        <Card className="p-8 backdrop-blur-none" data-tutorial="campaign-cards">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Active Campaigns</h2>
                <div data-tutorial="add-companies">
                    <AddMoreCompaniesDialog maxCompanies={maxCompanies} companiesUsed={companiesUsed} />
                </div>
            </div>

            <Results results={parsedResults} />
        </Card>
    </>
}

const ConfirmCompaniesWrapper = async ({ companiesToConfirm, userId }) => {
    const detailsRes = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/all_details`, {
        method: 'POST',
        credentials: 'include',       // Include cookie
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
            cookie: (await cookies()).toString()
        },
        body: JSON.stringify({ companyIds: companiesToConfirm }) // Corpo della richiesta con array di companyId
    });

    if (!detailsRes.ok) throw new Error(detailsRes.status);
    const detailsData = await detailsRes.json();
    if (!detailsData.success) throw new Error(detailsData.error);

    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/account", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) {
        throw new Error(res.status);
    }
    const d = await res.json();

    return (
        <ConfirmCompanies userId={userId} allDetails={detailsData.data} queries={d.data.queries} defaultInstructions={d.data.customizations.instructions} />
    )
}

const Page = async () => {
    let res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) {
        return redirect('/login')
        //throw new Error(res.status);
    }
    let data = await res.json();

    if (!data.success)
        return redirect('/login')
    //throw new Error(data.error)

    const user = data.user
    if (!user)
        redirect('/login')

    const currentStep = user.onboardingStep || 1

    if (currentStep < 10)
        return <OnboardingPage user={user} currentStep={currentStep} />

    return (
        <div className="space-y-8">
            <TutorialTrigger pageId="dashboard" steps={DASHBOARD_STEPS} />
            {/* Welcome Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome back {user.name}! 👋
                    </h1>
                    <p className="text-gray-400">
                        Here's what's happening with your work email generation
                    </p>
                </div>


            </div>

            <Suspense fallback={<DashboardSkeleton />}>
                <ResultsWrapper userId={user.uid} plan={user.plan ?? "unknown"} maxCompanies={user.maxCompanies} companiesUsed={user.companiesUsed} />
            </Suspense>

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
                    <Link href="/dashboard/plan-and-credits" className="w-max">
                    <Button variant="primary" icon={<Crown className="w-4 h-4" />}>
                        Upgrade Now
                    </Button>
                    </Link>
                </Card>
            </div>
        </div>
    );
}

export default Page;