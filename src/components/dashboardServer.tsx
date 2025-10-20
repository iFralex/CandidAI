import Dashboard, { AnimatedResults, CompanyLogo } from "@/components/dashboard";
import { notFound, redirect } from "next/navigation";
import OnboardingPage from "../../components/onboardingServer";
import { clientConfig, serverConfig } from "@/config";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import { ArrowRight, CheckCircle, RefreshCw, Send, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./ui/progress-bar";

export const Results = ({ results }) => {
    if (!results || results.length === 0) {
        return <p className="text-center text-gray-400">No campaigns found.</p>;
    }

    return (
        <AnimatedResults>
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
console.log(campaign.company)
    return (
        <Link href={`/dashboard/${campaign.id}`} className="block">
            <Card className="p-6 backdrop-blur-none transition-all duration-200 hover:bg-white/10 hover:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <CompanyLogo company={campaign.company.domain || campaign.company.name}/>
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
                            <span>{campaign.emailsGenerated} email{campaign.emailsGenerated > 1 ? 's' : ''} generated</span>
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
        {Array(10).fill(0).map((_, i) => <CampaignSkeleton key={i}/>)}
    </div>
);
