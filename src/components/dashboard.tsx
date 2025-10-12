"use client"

import { useState } from "react";
import { Button } from "./ui/button";
import { Badge, BarChart3, CheckCircle, Crown, ExternalLink, Mail, Plus, RefreshCw, Send, Timer } from "lucide-react";
import { Card } from "./ui/card";
const ProgressBar = ({ progress, className = '' }) => {
    return (
        <div className={`w-full bg-white/10 rounded-full h-2 overflow-hidden ${className}`}>
            <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
        </div>
    );
};
const Dashboard = ({ userData }) => {
    // Mock data for active campaigns
    const [campaigns] = useState([
        {
            id: 1,
            company: "Google",
            status: "processing",
            progress: 65,
            recruiterName: "Sarah Johnson",
            recruiterTitle: "Senior Technical Recruiter",
            startDate: "2024-01-15",
            estimatedCompletion: "2024-01-17",
            emailsGenerated: 0,
            stage: "Analyzing company culture"
        },
        {
            id: 2,
            company: "Microsoft",
            status: "processing",
            progress: 30,
            recruiterName: "Michael Chen",
            recruiterTitle: "Principal Recruiter - Engineering",
            startDate: "2024-01-16",
            estimatedCompletion: "2024-01-18",
            emailsGenerated: 0,
            stage: "Finding recruiter contacts"
        },
        {
            id: 3,
            company: "Netflix",
            status: "ready",
            progress: 100,
            recruiterName: "Emma Rodriguez",
            recruiterTitle: "Technical Talent Acquisition",
            startDate: "2024-01-10",
            completedDate: "2024-01-14",
            emailsGenerated: 2,
            stage: "Emails ready for review"
        },
        {
            id: 4,
            company: "Airbnb",
            status: "sent",
            progress: 100,
            recruiterName: "James Park",
            recruiterTitle: "Senior Engineering Recruiter",
            startDate: "2024-01-08",
            sentDate: "2024-01-15",
            emailsGenerated: 1,
            emailsSent: 1,
            stage: "Email sent successfully"
        }
    ]);

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

    const processingCampaigns = campaigns.filter(c => c.status === 'processing').length;
    const readyCampaigns = campaigns.filter(c => c.status === 'ready').length;
    const sentCampaigns = campaigns.filter(c => c.status === 'sent').length;
    const totalEmailsGenerated = campaigns.reduce((sum, c) => sum + c.emailsGenerated, 0);

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome back! 👋
                    </h1>
                    <p className="text-gray-400">
                        Here's what's happening with your job search campaigns
                    </p>
                </div>

                <Button
                    variant="primary"
                    icon={<Plus className="w-4 h-4" />}
                >
                    New Campaign
                </Button>
            </div>

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
                            <p className="text-gray-400 text-sm mb-1">Total Generated</p>
                            <p className="text-2xl font-bold text-white">{totalEmailsGenerated}</p>
                        </div>
                        <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                            <Mail className="w-6 h-6 text-violet-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Active Campaigns */}
            <Card className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Active Campaigns</h2>
                    <Badge variant="primary">{campaigns.length} total</Badge>
                </div>

                <div className="space-y-6">
                    {campaigns.map((campaign) => {
                        const statusInfo = getStatusInfo(campaign.status);

                        return (
                            <Card key={campaign.id} className="p-6 backdrop-blur-none" hover >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold">
                                            {campaign.company.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{campaign.company}</h3>
                                            <p className="text-gray-400 text-sm">{campaign.recruiterName} • {campaign.recruiterTitle}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <Badge variant={statusInfo.color} icon={statusInfo.icon}>
                                            {statusInfo.label}
                                        </Badge>

                                        {campaign.status === 'ready' && (
                                            <Button variant="primary" size="sm">
                                                Review Emails
                                            </Button>
                                        )}

                                        {campaign.status === 'sent' && (
                                            <Button variant="ghost" size="sm" icon={<BarChart3 className="w-4 h-4" />}>
                                                View Analytics
                                            </Button>
                                        )}
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
                        );
                    })}
                </div>
            </Card>

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
};

export default Dashboard