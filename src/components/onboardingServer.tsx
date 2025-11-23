import { getServerUser } from '@/lib/server-auth'
import { redirect } from 'next/navigation'
import { CheckCircle, CreditCard, Wand2 } from 'lucide-react'
import { PlanSelectionClient, CompanyInputClient, AdvancedFiltersClientWrapper, SetupCompleteClient, PaymentStepClient } from '@/components/onboarding'
import crypto from "crypto";
import { ProfileAnalysisClient } from '@/components/onboarding';
import { completeOnboarding, submitQueries } from '@/actions/onboarding-actions'
import { Button } from '@/components/ui/button'
import { cookies } from 'next/headers'
import { plansData, plansInfo } from '@/config';

interface SetupCompleteServerProps {
    userId: string
}

export function SetupCompleteServer({ userId }: SetupCompleteServerProps) {
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

            <SetupCompleteClient userId={userId} />
        </div>
    )
}

interface PaymentSetupServerProps {
    userId: string
}

export function PaymentStepServer({ userId }: PaymentSetupServerProps) {
    const amount = 1; // centesimi
    const transactionId = "TXN" + Date.now();
    const divisa = 978;
    const secret = process.env.NEXT_PUBLIC_NEXI_SECRET_KEY;

    const stringa = `codTrans=${transactionId}divisa=${divisa}importo=${amount}${secret}`;
    const mac = crypto.createHash("sha1").update(stringa).digest("hex");

    const serverResponse = {
        baseConfig: {
            apiKey: process.env.NEXT_PUBLIC_NEXI_ALIAS,
            environment: "PROD"
        },
        paymentParams: {
            amount: amount,
            transactionId: transactionId,
            currency: 978,
            timeStamp: Date.now(),
            mac: mac,
            url: process.env.NEXT_PUBLIC_DOMAIN + "/dashboard?callback",
            urlBack: process.env.NEXT_PUBLIC_DOMAIN + "/dashboard?callback",
            urlPost: process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/nexi-payment",
        },
        customParams: {},
        language: "ENG",
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CreditCard className="w-10 h-10 text-white" />
                </div>

                <h2 className="text-3xl font-bold text-white mb-4">
                    Payment Setup 💳
                </h2>
                <p className="text-lg text-gray-400">
                    Perfect! Before processing payments, let’s configure your preferred payment methods and billing options.
                </p>
            </div>

            <PaymentStepClient userId={userId} serverResponse={serverResponse}/>
        </div>
    )
}

interface AdvancedFiltersServerProps {
    userId: string
    plan: string
}

export async function AdvancedFiltersServer({ userId, plan }: AdvancedFiltersServerProps) {
    const maxFilters = plan === 'ultra' ? 50 : 30
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
    const data = await res.json();

    if (!data.success)
        throw new Error(data.error)

    const profileSummary = data.data.profileSummary
    const companies = profileSummary.experience.map(e => e.company.name)
    const universities = profileSummary.education.map(e => e.school.name)
    const location = profileSummary.location

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

    if (plan !== "pro" && plan !== "ultra") {
        return await submitQueries(userId, defaultStrategy)
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                    Advanced Recruiter Filters
                </h2>
                <p className="text-lg text-gray-400">
                    Add up to {maxFilters} filter{maxFilters > 1 ? 's' : ''} to find recruiters that perfectly match your preferences.
                    These filters help narrow down the search for more targeted results.
                </p>
            </div>

            <AdvancedFiltersClientWrapper userId={userId} maxStrategies={maxFilters} defaultStrategy={defaultStrategy} />

            <div className="text-center mt-6">
                <p className="text-sm text-gray-500">
                    You can always modify these filters later from your settings
                </p>
            </div>
        </div>
    )
}

interface ProfileAnalysisServerProps {
    userId: string
    plan: string
}

export function ProfileAnalysisServer({ userId, plan }: ProfileAnalysisServerProps) {
    return (
        <ProfileAnalysisClient userId={userId} plan={plan} />
    )
}

interface CompanyInputServerProps {
    userId: string
    plan: string
}

export function CompanyInputServer({ userId, plan }: CompanyInputServerProps) {
    const maxCompanies = plansData[plan]?.maxCompanies || 1

    const isUltraPlan = plan === 'ultra'

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
}

export function PlanSelectionServer({ userId }: PlanSelectionServerProps) {
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

            <PlanSelectionClient userId={userId} plans={plansInfo} />
        </div>
    )
}

export default async function OnboardingPage({ user, currentStep }) {
    return (
        <div className="container mx-auto px-4 py-8">
            {currentStep === 1 && (
                <PlanSelectionServer userId={user.uid} />
            )}

            {currentStep === 2 && (
                <CompanyInputServer
                    userId={user.uid}
                    plan={user.plan}
                />
            )}

            {currentStep === 3 && (
                <ProfileAnalysisServer userId={user.uid} plan={user.plan} />
            )}

            {currentStep === 4 && (
                <AdvancedFiltersServer
                    userId={user.uid}
                    plan={user.plan}
                />
            )}

            {currentStep === 5 && (
                <SetupCompleteServer userId={user.uid} />
            )}

            {currentStep === 6 && (
                <PaymentStepServer userId={user.uid} />
            )}
        </div>
    )
}