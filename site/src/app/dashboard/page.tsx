import OnboardingPage from "../../components/onboardingServer";
import { cookies } from "next/headers";
import { Suspense } from "react";

export const metadata = { title: "Dashboard" };
import { Results, ResultsSkeleton, CampaignSkeleton } from "@/components/dashboardServer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Building2, CheckCircle, Coins, Crown, ExternalLink, Mail, Plus, RefreshCw, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { AnimatedResults, AddMoreCompaniesDialog, ConfirmCompanies } from "@/components/dashboard";
import { DashboardTracker } from "@/components/DashboardTracker";
import { calculateProgress } from "@/components/detailsServer";
import Link from "next/link";
import { TutorialTrigger } from "@/components/TutorialTrigger";
import { AmbassadorPromo } from "@/components/AmbassadorPromo";
import { plansData } from "@/config";
import { beginPendingCampaignSetup } from "@/actions/onboarding-actions";

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
        description: 'Send emails to all companies that are ready with a single click, no need to open each one individually.',
    },
    {
        targetId: 'nav-follow-ups',
        title: 'Follow Ups',
        description: 'See when a conversation is worth continuing and generate a personalized follow-up only when you request it.',
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

function PaidCapacityBanner({ plan, maxCompanies = 0, companiesUsed = 0, credits = 0 }: { plan: string; maxCompanies?: number; companiesUsed?: number; credits?: number }) {
    const planData = plansData[plan as keyof typeof plansData]
    if (!planData || plan === "free_trial") return null

    const companiesRemaining = Math.max(0, maxCompanies - companiesUsed)
    const companyWarningAt = Math.max(2, Math.ceil(maxCompanies * 0.1))
    const companiesLow = companiesRemaining <= companyWarningAt
    const companiesEmpty = companiesRemaining === 0

    const includedCredits = planData.credits || 0
    const creditWarningAt = Math.max(100, Math.ceil(includedCredits * 0.1))
    const creditsLow = includedCredits > 0 && credits <= creditWarningAt
    const creditsEmpty = includedCredits > 0 && credits <= 0

    if (!companiesLow && !creditsLow) return null

    const bothLow = companiesLow && creditsLow
    const exhausted = companiesEmpty || creditsEmpty
    const title = bothLow
        ? exhausted ? "Your campaign needs more capacity." : "Your companies and credits are running low."
        : companiesLow
            ? companiesEmpty ? "You’ve used every company in this plan." : "You’re approaching your company limit."
            : creditsEmpty ? "You’ve run out of credits." : "Your credit balance is running low."

    return <Card hover={false} className={`relative overflow-hidden p-6 sm:p-8 ${exhausted ? "border-rose-400/35 bg-gradient-to-br from-rose-500/15 via-orange-500/10 to-transparent" : "border-amber-400/35 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent"}`}>
        <div className={`pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full blur-3xl ${exhausted ? "bg-rose-500/15" : "bg-amber-500/15"}`} />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${exhausted ? "border-rose-300/25 bg-rose-400/10 text-rose-300" : "border-amber-300/25 bg-amber-400/10 text-amber-300"}`}><AlertTriangle className="h-7 w-7" /></div>
                <div>
                    <Badge className={exhausted ? "border-rose-300/20 bg-rose-400/10 text-rose-300" : "border-amber-300/20 bg-amber-400/10 text-amber-300"}>{exhausted ? "Action needed" : "Capacity reminder"}</Badge>
                    <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{title}</h2>
                    <p className="mt-2 max-w-2xl leading-7 text-gray-300">Keep your outreach moving without interrupted recruiter searches or email generation.</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        {companiesLow && <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3"><Building2 className="h-5 w-5 text-amber-300" /><div><p className="text-xs text-gray-500">Companies remaining</p><p className="font-semibold text-white">{companiesRemaining} of {maxCompanies}</p></div></div>}
                        {creditsLow && <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3"><Coins className="h-5 w-5 text-amber-300" /><div><p className="text-xs text-gray-500">Credits remaining</p><p className="font-semibold text-white">{Math.max(0, credits).toLocaleString()}</p></div></div>}
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
                {companiesLow && <Link href="/dashboard/plan-and-credits#plans"><Button variant="primary" icon={<Building2 className="h-4 w-4" />}>Buy another plan</Button></Link>}
                {creditsLow && <Link href="/dashboard/plan-and-credits#credits"><Button variant={companiesLow ? "secondary" : "primary"} icon={<Coins className="h-4 w-4" />}>Top up credits</Button></Link>}
            </div>
        </div>
    </Card>
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
                followUp: info?.follow_up ?? null,
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
    const showFreePreviewUpgrade = Boolean(user.freePreviewConsumed) && (!user.plan || user.plan === "free_trial")

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

            {showFreePreviewUpgrade && (
                <Card hover={false} className="relative overflow-hidden border-violet-400/40 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-fuchsia-500/10 p-6 shadow-2xl shadow-violet-950/30 sm:p-8">
                    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4 sm:gap-5">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-400/15 text-violet-200">
                                <Mail className="h-7 w-7" />
                            </div>
                            <div>
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Badge className="border-emerald-300/20 bg-emerald-400/10 text-emerald-300"><CheckCircle className="mr-1 h-3.5 w-3.5" />First application generated</Badge>
                                </div>
                                <h2 className="text-2xl font-bold text-white sm:text-3xl">Your first personalized email has already been created.</h2>
                                <p className="mt-3 max-w-2xl leading-7 text-gray-300">You’ve completed the free preview. Choose a plan to research more companies, find more relevant recruiters, unlock verified email addresses, and generate new personalized outreach.</p>
                            </div>
                        </div>
                        <Link href="/dashboard/plan-and-credits#plans" className="shrink-0">
                            <Button size="lg" variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                                Choose a plan
                            </Button>
                        </Link>
                    </div>
                    <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-sm text-violet-100/80">
                        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-400" />More target companies</span>
                        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-400" />Verified recruiter emails</span>
                        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-400" />Advanced personalization</span>
                    </div>
                </Card>
            )}

            {user.campaignSetupPending && (
                <Card hover={false} className="relative overflow-hidden border-emerald-400/35 bg-gradient-to-br from-emerald-500/15 via-violet-500/10 to-transparent p-6 sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4 sm:gap-5">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300">
                                <CheckCircle className="h-7 w-7" />
                            </div>
                            <div>
                                <Badge className="border-emerald-300/20 bg-emerald-400/10 text-emerald-300">Plan upgraded</Badge>
                                <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Your current campaign keeps moving.</h2>
                                <p className="mt-2 max-w-2xl leading-7 text-gray-300">
                                    {user.generationsInProgress || "Your"} {user.generationsInProgress === 1 ? "company is" : "companies are"} still being generated with the settings used at launch. Your new profile, recruiter filters, and custom instructions will apply only to the next companies you launch.
                                </p>
                            </div>
                        </div>
                        <form action={beginPendingCampaignSetup} className="shrink-0">
                            <Button type="submit" size="lg" variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                                Configure new companies
                            </Button>
                        </form>
                    </div>
                </Card>
            )}

            {!showFreePreviewUpgrade && !user.campaignSetupPending && <PaidCapacityBanner plan={user.plan} maxCompanies={user.maxCompanies} companiesUsed={user.companiesUsed} credits={user.credits ?? 0} />}

            <Suspense fallback={<DashboardSkeleton />}>
                <ResultsWrapper userId={user.uid} plan={user.plan ?? "unknown"} maxCompanies={user.maxCompanies} companiesUsed={user.companiesUsed} />
            </Suspense>

            <AmbassadorPromo placement="dashboard" />

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6" gradient>
                    <h3 className="text-xl font-semibold text-white mb-4">Need Help?</h3>
                    <p className="text-gray-300 mb-4">
                        Our support team is here for you. Contact us for any questions or issues with your account.
                    </p>
                    <Link href="/dashboard/help">
                        <Button variant="secondary" icon={<ExternalLink className="w-4 h-4" />}>
                            Contact Support
                        </Button>
                    </Link>
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
