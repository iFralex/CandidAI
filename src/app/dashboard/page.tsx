import OnboardingPage from "../../components/onboardingServer";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { Results, ResultsSkeleton } from "@/components/dashboardServer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Crown, ExternalLink, Mail, Plus, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { AnimatedResults, ConfirmCompanies } from "@/components/dashboard";
import { calculateProgress } from "@/components/detailsServer";

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

async function ResultsWrapper({ userId }) {
    const parseResults = (results) => {
        delete results.companies_to_confirm
        return Object.entries(results).map(([id, info]) => {
            // valori sicuri
            const recruiterName = info?.recruiter?.name ?? null;
            const recruiterTitle = info?.recruiter?.job_title ?? null;
            const startDate = info?.start_date ? new Date(info?.start_date._seconds * 1000 + info?.start_date._nanoseconds / 1e6) : null;
            const company = info?.company ?? null;

            // calcola estimatedCompletion = start_date + 2 giorni (se start_date presente)
            let estimatedCompletion = null;
            if (startDate) {
                const d = startDate;
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
            cookie: await cookies()
        }
    });

    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const companiesToConfirm = data.data.companies_to_confirm
    const parsedResults = parseResults(data.data || {}).filter(i => !(companiesToConfirm || []).includes(i.id));
console.log(data.data)
    const processingCampaigns = Object.values(data.data)
        .filter(obj => !("email_sent" in obj))
        .length;
    const readyCampaigns = Object.values(data.data)
        .filter(obj => obj.email_sent === false)
        .length;
    const sentCampaigns = Object.values(data.data)
        .filter(obj => obj.email_sent !== false)
        .length;
    const articlesFound = Object.values(data.data)
  .reduce((sum, obj) => sum + (obj.blog_articles || 0), 0);

    return <>
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
                <Badge variant="primary"> total</Badge>
            </div>

            <Suspense fallback={<ResultsSkeleton />}>
                <ConfirmCompaniesWrapper userId={userId} companiesToConfirm={companiesToConfirm} />
            </Suspense>
        </Card>}

        {/* Active Campaigns */}
        <Card className="p-8 backdrop-blur-none">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Active Campaigns</h2>
                <Badge variant="primary"> total</Badge>
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
            cookie: await cookies()
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
            cookie: await cookies()
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
            cookie: await cookies()
        }
    });

    if (!res.ok) {
        throw new Error(res.status);
    }
    let data = await res.json();

    if (!data.success)
        throw new Error(data.error)

    const user = data.user
    if (!user)
        redirect('/login')

    const currentStep = user.onboardingStep || 1

    if (currentStep < 10)
        return <OnboardingPage user={user} currentStep={currentStep} />

    return (
        <div className="space-y-8">
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

                <Button
                    variant="primary"
                    icon={<Plus className="w-4 h-4" />}
                >
                    New Campaign
                </Button>
            </div>

            <Suspense fallback={<ResultsSkeleton />}>
                <ResultsWrapper userId={user.uid} />
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
                    <Button variant="primary" icon={<Crown className="w-4 h-4" />}>
                        Upgrade Now
                    </Button>
                </Card>
            </div>
        </div>
    );
}

export default Page;