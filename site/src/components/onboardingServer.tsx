import { CheckCircle, CreditCard, Wand2 } from 'lucide-react'
import { PlanSelectionClient, CompanyInputClient, AdvancedFiltersClientWrapper, SetupCompleteClient, ScrollToTop, OnboardingCompleteClient } from '@/components/onboarding'
import { ProfileAnalysisClient } from '@/components/onboarding';
import { UnifiedCheckout } from '@/components/UnifiedCheckout';
import { startServer, submitQueries, jumpToStep } from '@/actions/onboarding-actions'
import { cookies, headers } from 'next/headers'
import { plansData, plansInfo } from '@/config';
import { setTestMock } from '@/app/api/test/set-mock/route';
import { adminDb } from '@/lib/firebase-admin';
import { redirect } from 'next/navigation';
import { getPlanById } from '@/lib/utils';
import { OnboardingExperience } from '@/components/OnboardingExperience';
import type { OnboardingPreviewState, OnboardingStage } from '@/types/onboarding';

function toClientPreview(data: FirebaseFirestore.DocumentData | undefined, fallbackStage: OnboardingStage): OnboardingPreviewState {
    if (!data) return { status: "idle", stage: fallbackStage }

    // Never pass Firestore Timestamp/FieldValue instances across the RSC boundary.
    // Keep this projection explicit so new backend-only fields cannot break hydration.
    return {
        jobId: typeof data.jobId === "string" ? data.jobId : undefined,
        status: data.status || "idle",
        stage: data.stage || fallbackStage,
        resultId: typeof data.resultId === "string" ? data.resultId : undefined,
        company: data.company ? {
            name: String(data.company.name || ""),
            domain: data.company.domain ? String(data.company.domain) : undefined,
            linkedin_url: data.company.linkedin_url ? String(data.company.linkedin_url) : undefined,
        } : undefined,
        searchContext: data.searchContext ? {
            targetRole: data.searchContext.targetRole ? String(data.searchContext.targetRole) : undefined,
            queryCount: Number(data.searchContext.queryCount || 0),
            narrative: data.searchContext.narrative ? String(data.searchContext.narrative) : undefined,
            strengths: Array.isArray(data.searchContext.strengths) ? data.searchContext.strengths.map(String) : [],
        } : undefined,
        searchProgress: data.searchProgress ? {
            attempt: Number(data.searchProgress.attempt || 0),
            total: Number(data.searchProgress.total || 0),
            strategy: data.searchProgress.strategy ? String(data.searchProgress.strategy) : undefined,
            found: Boolean(data.searchProgress.found),
        } : undefined,
        recruiter: data.recruiter ? {
            name: String(data.recruiter.name || ""),
            jobTitle: String(data.recruiter.jobTitle || ""),
            linkedinUrl: data.recruiter.linkedinUrl ? String(data.recruiter.linkedinUrl) : undefined,
        } : undefined,
        recruiterProfile: data.recruiterProfile ? {
            location: data.recruiterProfile.location ? String(data.recruiterProfile.location) : undefined,
            summary: data.recruiterProfile.summary ? String(data.recruiterProfile.summary) : undefined,
            skills: Array.isArray(data.recruiterProfile.skills) ? data.recruiterProfile.skills.map(String) : [],
            experience: Array.isArray(data.recruiterProfile.experience) ? data.recruiterProfile.experience.map((item: any) => ({
                title: item.title ? String(item.title) : undefined,
                company: item.company ? String(item.company) : undefined,
                startDate: item.startDate ? String(item.startDate) : undefined,
                endDate: item.endDate ? String(item.endDate) : undefined,
            })) : [],
            education: Array.isArray(data.recruiterProfile.education) ? data.recruiterProfile.education.map((item: any) => ({
                school: item.school ? String(item.school) : undefined,
                degree: item.degree ? String(item.degree) : undefined,
            })) : [],
        } : undefined,
        matchedQuery: data.matchedQuery ? {
            id: data.matchedQuery.id,
            name: data.matchedQuery.name ? String(data.matchedQuery.name) : undefined,
            criteria: Array.isArray(data.matchedQuery.criteria) ? data.matchedQuery.criteria : [],
        } : undefined,
        email: data.email ? {
            subject: String(data.email.subject || ""),
            body: String(data.email.body || ""),
            keyPoints: Array.isArray(data.email.keyPoints) ? data.email.keyPoints.map(String) : [],
        } : undefined,
        recruiterInsight: data.recruiterInsight ? {
            reason: data.recruiterInsight.reason ? String(data.recruiterInsight.reason) : undefined,
            points: Array.isArray(data.recruiterInsight.points) ? data.recruiterInsight.points.map(String) : [],
        } : undefined,
        error: data.error ? {
            code: String(data.error.code || "unknown"),
            message: data.error.message ? String(data.error.message) : undefined,
            recoverable: Boolean(data.error.recoverable),
        } : undefined,
    }
}

function buildReplayStrategies(queries: unknown, matchedName?: string): string[] {
    if (!Array.isArray(queries)) return matchedName ? [matchedName] : []
    const baseNames = queries.map(query => String(query?.name || "")).filter(Boolean)
    const strategies = [
        ...baseNames,
        ...baseNames.map(name => `${name} (Owner/Founder)`),
        ...baseNames.map(name => `${name} (Senior)`),
        "General Employee",
    ]
    if (!matchedName) return strategies
    const winningIndex = strategies.indexOf(matchedName)
    return winningIndex >= 0 ? strategies.slice(0, winningIndex + 1) : [...strategies, matchedName]
}

interface SetupCompleteServerProps {
    userId: string
    currentStep: number
    plan: string
}

export async function SetupCompleteServer({ userId, currentStep, plan }: SetupCompleteServerProps) {
    let defaultCustomizations = {}
    try {
        const accountSnap = await adminDb.collection("users").doc(userId).collection("data").doc("account").get()
        defaultCustomizations = accountSnap.data()?.customizations || {}
    } catch (e) { /* fall through */ }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-white" />
                </div>

                <h2 className="text-3xl font-bold text-white mb-4">
                    Setup Complete! 🎉
                </h2>
                <p className="text-lg text-gray-400">
                    Great! Before we start generating your personalized emails, let's customize the style and focus to match your preferences.
                </p>
            </div>

            <SetupCompleteClient userId={userId} defaultCustomizations={defaultCustomizations} currentStep={currentStep} plan={plan} />
        </div>
    )
}

export async function PaymentStripeServer({ userId, plan, email }: { userId: string; plan: string; email?: string }) {
    if (getPlanById(plan).price === 0) {
        // Test bypass: skip Firestore operations (no Firebase in test environment)
        if (process.env.NODE_ENV !== 'production') {
            const cookieStore = await cookies();
            const testCookie = cookieStore.get('__playwright_user__')?.value;
            if (testCookie) {
                try {
                    const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                    userData.onboardingStep = 50;
                    setTestMock('/api/protected/user', { success: true, user: userData });
                } catch (e) { /* fall through */ }
                redirect('/dashboard');
            }
        }

        const userRef = adminDb.collection("users").doc(userId);

        await userRef.update({
            onboardingStep: 7,
        });

        await startServer(userId);

        redirect("/dashboard");
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CreditCard className="w-10 h-10 text-white" />
                </div>

                <h2 className="text-3xl font-bold text-white mb-4">
                    Complete Your Purchase 💳
                </h2>
                <p className="text-lg text-gray-400">
                    One-time payment: pay once, use until your company limit is reached.
                </p>
            </div>

            <UnifiedCheckout purchaseType="plan" itemId={plan} email={email ?? ""} />
        </div>
    )
}

interface AdvancedFiltersServerProps {
    userId: string
    plan: string
    currentStep: number
}

export async function AdvancedFiltersServer({ userId, plan, currentStep }: AdvancedFiltersServerProps) {
    const maxFilters = plan === 'ultra' ? 50 : 30
    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/account", {
        cache: "no-cache",
        headers: {
            cookie: (await headers()).get('cookie') ?? ''
        }
    });

    if (!res.ok) {
        throw new Error(res.status);
    }
    const data = await res.json();

    if (!data.success)
        throw new Error(data.error)

    const profileSummary = data.data.profileSummary
    const companies = [...new Set(profileSummary?.experience?.map(e => e.company?.name).filter(Boolean) ?? [])]
    const universities = [...new Set(profileSummary?.education?.map(e => e.school?.name).filter(Boolean) ?? [])]
    const location = profileSummary?.location ?? {}

    // Funzione helper per generare l'array di criteria in base alle condizioni
    const buildCriteria = (base = []) => {
        const criteria = [...base];

        if (profileSummary.skills?.length > 0) {
            criteria.push({ key: 'skills', value: profileSummary.skills });
        }

        if (companies?.length > 0) {
            criteria.push({ key: 'company_name', value: companies });
        }

        if (universities?.length > 0) {
            criteria.push({ key: 'school_name', value: universities });
        }

        return criteria;
    };

    const buildCountryCriteria = (base = []) =>
        location.country
            ? [...base, { key: 'location_country', value: [location.country.toLowerCase()] }]
            : base;

    const buildContinentCriteria = (base = []) =>
        location.continent
            ? [...base, { key: 'location_continent', value: [location.continent.toLowerCase()] }]
            : base;

    // Strategia iniziale (potenzialmente con duplicati)
    const rawStrategies = [
        { name: 'Senior Tech Roles with All Criteria in Target Country', criteria: buildCountryCriteria(buildCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }])) },
        { name: 'Senior Tech Roles with Companies & Universities in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : []), ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])]) },
        { name: 'Senior Tech Roles with All Criteria in Target Continent', criteria: buildContinentCriteria(buildCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }])) },
        { name: 'Skills, Companies & Universities Match', criteria: buildCriteria() },
        { name: 'Senior Tech Roles with Companies & Universities in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : []), ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])]) },
        { name: 'Companies & Universities Match', criteria: [...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : []), ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])] },
        { name: 'Senior Tech Roles with Skills & Universities in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : []), ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])]) },
        { name: 'Senior Tech Roles with Skills & Companies in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : []), ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : [])]) },
        { name: 'Senior Tech Roles with Universities in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])]) },
        { name: 'Senior Tech Roles with Skills & Universities in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : []), ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])]) },
        { name: 'Senior Tech Roles with Companies in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : [])]) },
        { name: 'Senior Tech Roles with Skills & Companies in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : []), ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : [])]) },
        { name: 'Senior Tech Roles with Skills in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : [])]) },
        { name: 'Skills & Universities Match', criteria: [...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : []), ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])] },
        { name: 'Skills & Companies Match', criteria: [...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : []), ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : [])] },
        { name: 'Senior Tech Roles with Universities in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])]) },
        { name: 'Senior Tech Roles with Companies in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : [])]) },
        { name: 'Universities Match', criteria: [...(universities?.length > 0 ? [{ key: 'school_name', value: universities }] : [])] },
        { name: 'Companies Match', criteria: [...(companies?.length > 0 ? [{ key: 'company_name', value: companies }] : [])] },
        { name: 'Skills in Target Country', criteria: buildCountryCriteria([...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : [])]) },
        { name: 'Senior Tech Roles with Skills in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }, ...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : [])]) },
        { name: 'Senior Tech Roles in Target Country', criteria: buildCountryCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }]) },
        { name: 'Skills in Target Continent', criteria: buildContinentCriteria([...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : [])]) },
        { name: 'Skills Match', criteria: [...(profileSummary.skills?.length > 0 ? [{ key: 'skills', value: profileSummary.skills }] : [])] },
        { name: 'Target Country Only', criteria: buildCountryCriteria([]) },
        { name: 'Senior Tech Roles in Target Continent', criteria: buildContinentCriteria([{ key: 'job_title_levels', value: ['senior', 'manager', 'director'] }]) },
        { name: 'Target Continent Only', criteria: buildContinentCriteria([]) },
        { name: 'Any Available Recruiter', criteria: [] }
    ];

    // Funzione per serializzare un criterio per confronto
    const serializeCriteria = (criteria) =>
        JSON.stringify([...criteria].sort((a, b) => a.key.localeCompare(b.key)));

    // Deduplicazione
    const seen = new Set();
    const defaultStrategy = [];
    let id = 1;

    for (const s of rawStrategies) {
        const serialized = serializeCriteria(s.criteria);
        if (!seen.has(serialized)) {
            seen.add(serialized);
            defaultStrategy.push({ id: id++, ...s });
        }
    }

    const isProOrUltra = plan === "pro" || plan === "ultra"

    // Use saved queries if available, otherwise use generated defaults
    const existingQueries = data.data.queries
    const strategyToUse = isProOrUltra && existingQueries && existingQueries.length > 0 ? existingQueries : defaultStrategy

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                    Advanced Recruiter Filters
                </h2>
                <p className="text-lg text-gray-400">
                    {isProOrUltra
                        ? `Add up to ${maxFilters} filter${maxFilters > 1 ? 's' : ''} to find recruiters that perfectly match your preferences. These filters help narrow down the search for more targeted results.`
                        : "A default recruiter targeting strategy has been generated based on your profile. Upgrade to Pro or Ultra to customize it."
                    }
                </p>
            </div>

            <AdvancedFiltersClientWrapper userId={userId} maxStrategies={maxFilters} defaultStrategy={strategyToUse} currentStep={currentStep} plan={plan} readOnly={!isProOrUltra} />

            {isProOrUltra && (
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-500">
                        You can always modify these filters later from your settings
                    </p>
                </div>
            )}
        </div>
    )
}

export async function OnboardingCompleteServer({ userId }: { userId: string }) {
    let companies: { name: string; domain?: string; linkedin_url?: string }[] = []
    try {
        const accountSnap = await adminDb.collection("users").doc(userId).collection("data").doc("account").get()
        companies = accountSnap.data()?.companies || []
    } catch (e) { /* fall through */ }

    return <OnboardingCompleteClient companies={companies} />
}

interface ProfileAnalysisServerProps {
    userId: string
    plan: string
    currentStep: number
}

export async function ProfileAnalysisServer({ userId, plan, currentStep }: ProfileAnalysisServerProps) {
    let initialProfile = null
    let initialCvUrl = null
    try {
        const accountSnap = await adminDb.collection("users").doc(userId).collection("data").doc("account").get()
        initialProfile = accountSnap.data()?.profileSummary || null
        initialCvUrl = accountSnap.data()?.cvUrl || null
    } catch (e) { /* fall through */ }

    return (
        <ProfileAnalysisClient userId={userId} plan={plan} initialProfile={initialProfile} initialCvUrl={initialCvUrl} currentStep={currentStep} />
    )
}

interface CompanyInputServerProps {
    userId: string
    plan: string
    currentStep: number
}

export async function CompanyInputServer({ userId, plan, currentStep }: CompanyInputServerProps) {
    const maxCompanies = plansData[plan]?.maxCompanies || 1
    const isUltraPlan = plan === 'ultra'

    let initialCompanies: any[] = []
    try {
        const accountSnap = await adminDb.collection("users").doc(userId).collection("data").doc("account").get()
        initialCompanies = accountSnap.data()?.companies || []
    } catch (e) { /* fall through */ }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                    Add Your Target Companies
                </h2>
                <p className="text-lg text-gray-400">
                    {isUltraPlan
                        ? "Add companies by name or let our AI recommend the perfect matches for your profile"
                        : "Add the companies you'd like to target in your job search"
                    }
                </p>
            </div>

            <CompanyInputClient
                userId={userId}
                maxCompanies={maxCompanies}
                planType={plan}
                isUltraPlan={isUltraPlan}
                initialCompanies={initialCompanies}
                currentStep={currentStep}
                plan={plan}
            />

            <div className="text-center mt-6">
                <p className="text-sm text-gray-500">
                    You can add more companies later from your dashboard
                </p>
            </div>
        </div>
    )
}

interface PlanSelectionServerProps {
    userId: string
    currentPlan?: string
}

export function PlanSelectionServer({ userId, currentPlan }: PlanSelectionServerProps) {
    return (
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
                <div className="inline-flex items-center space-x-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-6">
                    <Wand2 className="w-5 h-5 text-violet-400" />
                    <span className="text-gray-300">Welcome to CandidAI</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent">
                    Choose Your Success Plan
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Select the perfect plan for your job search journey. Start with our free trial to experience the magic of AI-powered personalization.
                </p>
            </div>

            <PlanSelectionClient userId={userId} plans={plansInfo} selectedPlan={currentPlan} />
        </div>
    )
}

export default async function OnboardingPage({ user, currentStep }) {
    const testCookie = process.env.NODE_ENV !== 'production'
        ? (await cookies()).get('__playwright_user__')?.value
        : undefined
    if (testCookie) {
        const stage = (user.onboardingStage as OnboardingStage | undefined)
            || (currentStep >= 5 ? "email_generation" : currentStep === 4 ? "recruiter_search" : currentStep === 3 ? "target_company" : "profile_source")
        return (
            <div className="container mx-auto px-4 py-8">
                <OnboardingExperience
                    user={user}
                    stage={stage}
                    profile={user.account?.profileSummary}
                    cvUrl={user.account?.cvUrl}
                    companies={user.account?.companies || []}
                    initialPreview={user.onboardingPreview || { status: "idle", stage }}
                />
            </div>
        )
    }
    const userRef = adminDb.collection("users").doc(user.uid)
    const [userSnap, accountSnap, previewSnap] = await Promise.all([
        userRef.get(),
        userRef.collection("data").doc("account").get(),
        userRef.collection("data").doc("onboarding_preview").get(),
    ])
    const account = accountSnap.data() || {}
    const storedStage = userSnap.data()?.onboardingStage as OnboardingStage | undefined
    const fallbackStage: OnboardingStage = currentStep >= 5 ? "email_generation" : currentStep === 4 ? "recruiter_search" : currentStep === 3 ? "target_company" : "profile_source"
    const stage = storedStage || fallbackStage
    const preview = toClientPreview(previewSnap.data(), stage)
    preview.replayStrategies = buildReplayStrategies(account.queries, preview.matchedQuery?.name)

    return (
        <div className="container mx-auto px-4 py-8">
            <ScrollToTop step={currentStep} />
            <OnboardingExperience
                user={user}
                stage={stage}
                profile={account.profileSummary}
                cvUrl={account.cvUrl}
                companies={account.companies || []}
                initialPreview={preview}
            />
        </div>
    )
}
