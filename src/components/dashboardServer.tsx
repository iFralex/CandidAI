import Dashboard, { AnimatedResults, CompanyLogo } from "@/components/dashboard";
import { notFound, redirect } from "next/navigation";
import OnboardingPage from "../../components/onboardingServer";
import { clientConfig, serverConfig } from "@/config";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import { ArrowRight, Building2, Calendar, Check, CheckCircle, Globe, MapPin, RefreshCw, Send, Timer, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./ui/progress-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { confirmCompany } from "@/actions/onboarding-actions";

export const Results = ({ results }) => {
    if (!results || results.length === 0) {
        return <p className="text-center text-gray-400">No campaigns found.</p>;
    }

    return (
        <AnimatedResults className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {results.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
        </AnimatedResults>
    );
};

export const CampaignCard = ({ campaign }) => {
    const getStatusInfo = (status) => {
        const statusMap = {
            processing: {
                color: 'processing',
                icon: <RefreshCw className="w-4 h-4 animate-spin" />,
                label: 'Processing'
            },
            ready: {
                color: 'success',
                icon: <CheckCircle className="w-4 h-4" />,
                label: 'Ready to Send'
            },
            sent: {
                color: 'default',
                icon: <Send className="w-4 h-4" />,
                label: 'Sent'
            },
            paused: {
                color: 'warning',
                icon: <Timer className="w-4 h-4" />,
                label: 'Paused'
            }
        };
        return statusMap[status] || statusMap.processing;
    };

    const statusInfo = getStatusInfo(campaign.status);

    if (!campaign.company || !campaign.company.name || !campaign.company.domain) return

    return (
        <Link href={`/dashboard/${campaign.id}`} className="block">
            <Card className="p-6 backdrop-blur-none transition-all duration-200 hover:bg-white/10 hover:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <CompanyLogo company={campaign.company.domain || campaign.company.name} />
                        <div>
                            <h3 className="text-lg font-semibold text-white">{campaign.company.name}</h3>
                            {campaign.recruiterName && <p className="text-gray-400 text-sm">{campaign.recruiterName} • {campaign.recruiterTitle}</p>}
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="md" icon={<ArrowRight className="w-4 h-4" />}>
                            Info
                        </Button>
                    </div>
                </div>


                {campaign.status === 'processing' && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">{campaign.stage}</span>
                            <span className="text-sm text-gray-400">{campaign.progress}%</span>
                        </div>
                        <ProgressBar progress={campaign.progress} />
                    </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center space-x-4">
                        <span>Started: {new Date(campaign.startDate).toLocaleDateString()}</span>
                        {campaign.estimatedCompletion && (
                            <span>ETA: {new Date(campaign.estimatedCompletion).toLocaleDateString()}</span>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        {campaign.emailsGenerated > 0 && (
                            <span>Email  generated</span>
                        )}
                        {campaign.emailsSent > 0 && (
                            <span>{campaign.emailsSent} sent</span>
                        )}
                    </div>
                </div>
            </Card>
        </Link>
    );
};

export const CampaignSkeleton = () => {
    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
                <Skeleton className="h-10 w-20" />
            </div>
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
        </Card>
    );
};

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

export const ResultsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array(10).fill(0).map((_, i) => <CampaignSkeleton key={i} />)}
    </div>
);

export const ConfirmCompanies = ({ allDetails }) => {
    const formatNumber = (num) => {
        if (!num) return 'N/A';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatCurrency = (amount) => {
        if (!amount) return null;
        return `$${formatNumber(amount)}`;
    };

    return (
        <>
            {allDetails?.map((item) => {
                const company = item.data?.company_info || item.data?.company;
                const companyId = item.companyId;

                return (
                    <Card
                        key={companyId}
                        className={'p-6 backdrop-blur-none transition-all duration-200 border-2 border-gray-700 hover:bg-white/5'}
                    >
                        {/* Header with Logo and Actions */}
                        <div className="flex items-start justify-between mb-6 gap-4">
                            <div className="flex items-start space-x-4 flex-1">
                                <CompanyLogo
                                    company={company.website || company.name}
                                />
                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold text-white mb-1">
                                        {company.display_name || company.name}
                                    </h3>
                                    {company.headline && (
                                        <p className="text-gray-400 text-sm mb-2">{company.headline}</p>
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

                            <div className="flex flex-col gap-2">
                                <Button
                                    icon={<Check className="w-4 h-4" />}
                                >
                                    Confirm
                                </Button>
                                <Button
                                    variant="secondary"
                                    icon={<X className="w-4 h-4" color="red" />}
                                    type="submit"
                                >
                                    Wrong Company
                                </Button>
                            </div>
                        </div>

                        {/* Company Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            {company.employee_count && (
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                        <Users className="w-3 h-3" />
                                        EMPLOYEES
                                    </div>
                                    <div className="text-white font-semibold">
                                        {formatNumber(company.employee_count)}
                                        {company.size && <span className="text-gray-400 text-sm ml-2">({company.size})</span>}
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
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    {company.summary}
                                </p>
                            </div>
                        )}

                        {/* Tags and Additional Info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            {company.tags && company.tags.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {company.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    {company.tags.length > 5 && (
                                        <span className="text-gray-400 text-xs">
                                            +{company.tags.length - 5} more
                                        </span>
                                    )}
                                </div>
                            )}

                            {company.type && (
                                <span className="text-gray-400">
                                    Type: <span className="text-white">{company.type}</span>
                                </span>
                            )}

                            {company.ticker && (
                                <span className="text-gray-400">
                                    Ticker: <span className="text-white font-mono">{company.ticker}</span>
                                </span>
                            )}
                        </div>

                        {/* Employee Count by Country */}
                        {company.employee_count_by_country && Object.keys(company.employee_count_by_country).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <div className="text-xs text-gray-400 mb-2">EMPLOYEE DISTRIBUTION</div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(company.employee_count_by_country)
                                        .sort(([, a], [, b]) => b - a)
                                        .slice(0, 5)
                                        .map(([country, count]) => (
                                            <span key={country} className="text-xs bg-white/5 px-2 py-1 rounded text-gray-300">
                                                {country}: {formatNumber(count)}
                                            </span>
                                        ))}
                                </div>
                            </div>
                        )}
                    </Card>
                );
            })}
        </>
    );
};