"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, Sparkles, Target, Zap, Users, Mail, ArrowRight, Check, Star, Play, X, Menu, Clock, TrendingUp, Shield, Award, MessageSquare, BarChart3, Filter, Brain, Eye, Send, Calendar, MapPin, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Review, reviews } from './reviews';

const Badge = ({ children, variant = 'default', className = '' }) => {
    const variants = {
        default: "bg-white/10 text-gray-300",
        primary: "bg-gradient-to-r from-violet-500 to-purple-500 text-white",
        success: "bg-green-500/20 text-green-400",
        warning: "bg-yellow-500/20 text-yellow-400"
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

// Animated Background Component
const AnimatedBackground = () => {
    return (
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-purple-900/20 to-pink-900/20"></div>
            {[...Array(8)].map((_, i) => (
                <div
                    key={i}
                    className={`absolute w-72 h-72 rounded-full blur-xl opacity-20 animate-pulse`}
                    style={{
                        background: `radial-gradient(circle, ${['#8b5cf6', '#a855f7', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#06b6d4', '#10b981'][i]
                            } 0%, transparent 70%)`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${i * 2}s`,
                        animationDuration: `${4 + i}s`
                    }}
                />
            ))}
        </div>
    );
};

// Hero Section Component
const HeroSection = () => {
    const router = useRouter()
    const [email, setEmail] = useState('');

    return (
        <section className="relative min-h-screen flex items-center justify-center px-6 lg:px-8">
            <AnimatedBackground />
            <div className="relative z-10 text-center max-w-5xl mx-auto">
                <Badge variant="primary" className="mb-6 inline-flex items-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Revolutionary AI-Powered Recruitment</span>
                </Badge>

                <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent leading-tight">
                    Land Your Dream Job with
                    <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        AI-Crafted Emails
                    </span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                    Our AI analyzes your profile, finds the perfect recruiters at your target companies, and crafts personalized emails that get responses. Transform your job search from hours to minutes.
                </p>

                <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-2xl p-6 mb-8 max-w-2xl mx-auto">
                    <h3 className="text-xl font-semibold text-white mb-2">🎯 Try Before You Buy</h3>
                    <p className="text-gray-300">
                        Test our AI with one personalized email for one recruiter at your chosen company - completely free!
                    </p>
                </div>

                <form onSubmit={() => router.push("/login?email=" + email)} className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto mb-8">
                    <Input
                        type="email"
                        placeholder="Enter your email to start"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button formAction="submit" className='min-w-48' size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                        Start Free Test
                    </Button>
                </form>

                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>No credit card required</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>One free test email</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Setup in 2 minutes</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                <ChevronDown className="w-8 h-8 text-gray-400" />
            </div>
        </section>
    );
};

// Stats Section Component
const StatsSection = () => {
    const stats = [
        { number: "10,000+", label: "Emails Generated", icon: <Mail className="w-8 h-8" /> },
        { number: "87%", label: "Response Rate", icon: <TrendingUp className="w-8 h-8" /> },
        { number: "2,500+", label: "Happy Job Seekers", icon: <Users className="w-8 h-8" /> },
        { number: "24hrs", label: "Average Processing", icon: <Clock className="w-8 h-8" /> }
    ];

    return (
        <section className="relative py-16 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, index) => (
                        <div key={index} className="text-center">
                            <div className="text-violet-400 mb-4 flex justify-center">
                                {stat.icon}
                            </div>
                            <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                                {stat.number}
                            </div>
                            <div className="text-gray-400">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// Time & Cost Savings Section
const SavingsSection = () => {
    return (
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Stop Wasting Time & Money
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        See how RecruiterAI transforms your job search economics
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <Card className="p-8">
                        <h3 className="text-2xl font-bold text-red-400 mb-6 text-center">❌ Manual Approach</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">Research per company</span>
                                <span className="text-white font-semibold">2-3 hours</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">Find recruiter contacts</span>
                                <span className="text-white font-semibold">1-2 hours</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">Write personalized email</span>
                                <span className="text-white font-semibold">30-45 mins</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">LinkedIn Premium (monthly)</span>
                                <span className="text-white font-semibold">€59.99</span>
                            </div>
                            <div className="flex justify-between items-center py-3 pt-4 border-t border-red-500/30">
                                <span className="text-red-400 font-semibold">Total per company</span>
                                <span className="text-red-400 font-bold text-lg">4+ hours + €60/mo</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8" gradient>
                        <h3 className="text-2xl font-bold text-green-400 mb-6 text-center">✅ RecruiterAI</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">AI research & analysis</span>
                                <span className="text-white font-semibold">Automated</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">Recruiter identification</span>
                                <span className="text-white font-semibold">Automated</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">Email generation</span>
                                <span className="text-white font-semibold">Automated</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-gray-300">Your setup time</span>
                                <span className="text-white font-semibold">2 minutes</span>
                            </div>
                            <div className="flex justify-between items-center py-3 pt-4 border-t border-green-500/30">
                                <span className="text-green-400 font-semibold">Total per company</span>
                                <span className="text-green-400 font-bold text-lg">2 mins + €0.25-0.60</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="mt-12 text-center">
                    <Card className="p-8 max-w-3xl mx-auto" gradient>
                        <h3 className="text-2xl font-bold text-white mb-4">💰 Your Savings with RecruiterAI</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <div className="text-3xl font-bold text-green-400 mb-2">120+ Hours</div>
                                <div className="text-gray-300">Saved per month</div>
                                <div className="text-sm text-gray-400 mt-1">(for 25 companies)</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-green-400 mb-2">€1,800+</div>
                                <div className="text-gray-300">Value created monthly</div>
                                <div className="text-sm text-gray-400 mt-1">(at €15/hour rate)</div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
};

// Features Section Component
const FeaturesSection = () => {
    const features = [
        {
            icon: <Brain className="w-8 h-8" />,
            title: "AI Profile Analysis",
            description: "Our advanced AI analyzes your LinkedIn profile and career goals to understand your unique value proposition and ideal recruiter match."
        },
        {
            icon: <Target className="w-8 h-8" />,
            title: "Smart Recruiter Matching",
            description: "We identify the perfect recruiters at each company based on your skills, experience, and career aspirations with advanced filtering options."
        },
        {
            icon: <Eye className="w-8 h-8" />,
            title: "Deep Company Intelligence",
            description: "Comprehensive research on company culture, recent news, blog posts, and job market trends to craft highly relevant messaging."
        },
        {
            icon: <Sparkles className="w-8 h-8" />,
            title: "Personalized Email Generation",
            description: "Each email is uniquely crafted with company insights, role-specific messaging, and your personal brand story."
        },
        {
            icon: <Calendar className="w-8 h-8" />,
            title: "Follow-up Automation",
            description: "AI-powered follow-up sequences with perfect timing notifications to maximize your response rates."
        },
        {
            icon: <BarChart3 className="w-8 h-8" />,
            title: "Advanced Analytics",
            description: "Track open rates, responses, and engagement with detailed analytics to optimize your job search strategy."
        }
    ];

    return (
        <section id="features" className="relative py-24 px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Powered by Advanced AI
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Experience the future of job searching with AI that understands your career goals and crafts messages that actually work.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <Card key={index} className="p-8 group">
                            <div className="mb-6 text-violet-400 group-hover:text-violet-300 transition-colors">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-4">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};

// How It Works Section
const ProcessSection = () => {
    const steps = [
        {
            step: "01",
            title: "Account Setup",
            description: "Create your account and choose your plan. Add target companies based on your subscription level.",
            icon: <Users className="w-6 h-6" />
        },
        {
            step: "02",
            title: "Profile Analysis",
            description: "Share your LinkedIn profile. Our AI analyzes your experience and generates your ideal recruiter persona.",
            icon: <Brain className="w-6 h-6" />
        },
        {
            step: "03",
            title: "Advanced Filtering",
            description: "Set location, experience, and other filters (Pro/Ultra plans) to find perfectly matched recruiters.",
            icon: <Filter className="w-6 h-6" />
        },
        {
            step: "04",
            title: "AI Processing",
            description: "Our AI researches companies, analyzes recruiters, and generates personalized emails. Takes 24hrs-7 days.",
            icon: <Zap className="w-6 h-6" />
        },
        {
            step: "05",
            title: "Review & Send",
            description: "Access your dashboard, review generated emails, make edits if needed, and send with one click.",
            icon: <Send className="w-6 h-6" />
        },
        {
            step: "06",
            title: "Follow-up & Track",
            description: "Automatic follow-up suggestions with perfect timing, plus detailed analytics on all your outreach.",
            icon: <BarChart3 className="w-6 h-6" />
        }
    ];

    return (
        <section id="process" className="relative py-24 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        How RecruiterAI Works
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        From setup to success in 6 simple steps. Let AI handle the heavy lifting while you focus on interviews.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {steps.map((step, index) => (
                        <Card key={index} className="p-8 relative">
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">{step.step}</span>
                            </div>
                            <div className="mb-4 text-violet-400">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-4">{step.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{step.description}</p>
                        </Card>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Card className="p-8 max-w-2xl mx-auto" gradient>
                        <h3 className="text-xl font-bold text-white mb-4">📧 Email Updates Every Step</h3>
                        <p className="text-gray-300">
                            Stay informed with email notifications for profile analysis completion, processing status,
                            and when your personalized emails are ready to review and send.
                        </p>
                    </Card>
                </div>
            </div>
        </section>
    );
};

// Email Examples Section
const EmailExamplesSection = () => {
    const [selectedExample, setSelectedExample] = useState(0);

    const examples = [
        {
            company: "TechCorp",
            role: "Senior Frontend Developer",
            subject: "Passionate Frontend Developer - Excited About TechCorp's Innovation",
            preview: "Hi Sarah,\n\nI came across TechCorp's recent blog post about micro-frontend architecture and was genuinely impressed by your team's innovative approach...\n\nAs a Senior Frontend Developer with 5 years of experience in React and TypeScript, I've implemented similar solutions at my current role...",
            recruiter: "Sarah Johnson",
            responseRate: "92%"
        },
        {
            company: "StartupXYZ",
            role: "Product Manager",
            subject: "Product Manager with B2B SaaS Experience - StartupXYZ Opportunity",
            preview: "Hi Michael,\n\nStartupXYZ's recent Series B announcement caught my attention, particularly your expansion into the enterprise market...\n\nWith 4 years of B2B SaaS product management experience, I've successfully launched products that align perfectly with your roadmap...",
            recruiter: "Michael Chen",
            responseRate: "89%"
        },
        {
            company: "FinanceFlow",
            role: "Data Scientist",
            subject: "ML Engineer Excited About FinanceFlow's AI-Driven Solutions",
            preview: "Hi Emma,\n\nI was fascinated by FinanceFlow's recent presentation at FinTech Summit about using ML for fraud detection...\n\nAs a Data Scientist with expertise in anomaly detection and financial modeling, I've developed similar systems...",
            recruiter: "Emma Rodriguez",
            responseRate: "94%"
        }
    ];

    return (
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        See AI-Generated Emails in Action
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Real examples of personalized emails that got responses. Each one crafted specifically for the recruiter and company.
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4">
                        {examples.map((example, index) => (
                            <Card
                                key={index}
                                className={`p-6 cursor-pointer transition-all duration-300 ${selectedExample === index ? 'ring-2 ring-violet-500 bg-white/10' : ''
                                    }`}
                                hover={false}
                                onClick={() => setSelectedExample(index)}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white font-semibold">{example.company}</h3>
                                    <Badge variant="success">{example.responseRate} response</Badge>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">{example.role}</p>
                                <p className="text-gray-500 text-xs">To: {example.recruiter}</p>
                            </Card>
                        ))}
                    </div>

                    <div className="lg:col-span-2">
                        <Card className="p-8">
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-white mb-2">{examples[selectedExample].company}</h3>
                                <p className="text-violet-400 mb-4">{examples[selectedExample].role}</p>
                                <div className="bg-black/30 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-gray-400 mb-2">Subject:</p>
                                    <p className="text-white font-medium">{examples[selectedExample].subject}</p>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <Mail className="w-4 h-4 text-violet-400" />
                                        <span className="text-sm text-gray-400">To: {examples[selectedExample].recruiter}</span>
                                    </div>
                                    <Badge variant="success">{examples[selectedExample].responseRate}</Badge>
                                </div>

                                <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                                    {examples[selectedExample].preview}
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <p className="text-sm text-gray-500">
                                        ... and 3 more personalized paragraphs with specific company insights and call-to-action
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    );
};

// Pricing Section Component
const PricingSection = () => {
    const [isAnnual, setIsAnnual] = useState(false);
    const [couponCode, setCouponCode] = useState('');

    const plans = [
        {
            name: "Base",
            price: 25,
            description: "Perfect for targeted job search",
            features: [
                "25 companies maximum",
                "10 recruiters analyzed per company",
                "3 detailed recruiter profiles",
                "1 personalized email per company",
                "Basic company intelligence",
                "Email support"
            ],
            limits: "25 companies",
            popular: false
        },
        {
            name: "Pro",
            price: 59,
            description: "For serious job seekers",
            features: [
                "100 companies maximum",
                "25 recruiters analyzed per company",
                "10 detailed recruiter profiles",
                "2 personalized emails per company",
                "1 additional search filter",
                "Follow-up email automation",
                "Advanced company intelligence",
                "Priority support"
            ],
            limits: "100 companies",
            popular: true
        },
        {
            name: "Ultra",
            price: 119,
            description: "Maximum job search power",
            features: [
                "200 companies maximum",
                "100 recruiters analyzed per company",
                "25 detailed recruiter profiles",
                "3 personalized emails per company",
                "3 additional search filters",
                "AI company recommendations",
                "Company name search (no URLs needed)",
                "Follow-up email automation",
                "Premium company intelligence",
                "Dedicated support"
            ],
            limits: "200 companies",
            popular: false
        }
    ];

    return (
        <section id="pricing" className="relative py-24 px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Choose Your Success Plan
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                        All plans include AI-powered personalization and our signature email crafting. Start with a free test!
                    </p>

                    <div className="flex items-center justify-center space-x-4 mb-8">
                        <span className={`${!isAnnual ? 'text-white' : 'text-gray-400'}`}>Monthly</span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? 'bg-violet-500' : 'bg-gray-600'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${isAnnual ? 'translate-x-8' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                        <span className={`${isAnnual ? 'text-white' : 'text-gray-400'}`}>Annual</span>
                        {isAnnual && (
                            <Badge variant="success">Save 20%</Badge>
                        )}
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-12">
                    {plans.map((plan, index) => (
                        <Card
                            key={index}
                            className={`p-8 relative ${plan.popular ? 'ring-2 ring-violet-500' : ''
                                }`}
                            gradient={plan.popular}
                            hover={false}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                    <Badge variant="primary">Most Popular</Badge>
                                </div>
                            )}

                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                                <p className="text-gray-400 mb-4">{plan.description}</p>
                                <div className="mb-4">
                                    <span className="text-4xl font-bold text-white">
                                        €{isAnnual ? Math.round(plan.price * 0.8) : plan.price}
                                    </span>
                                    <span className="text-gray-400">/mo</span>
                                </div>
                                <p className="text-sm text-violet-400">{plan.limits}</p>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {plan.features.map((feature, fIndex) => (
                                    <li key={fIndex} className="flex items-start space-x-3">
                                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-300 text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button
                                variant={plan.popular ? "primary" : "secondary"}
                                className="w-full"
                                size="md"
                            >
                                Start with Free Test
                            </Button>
                        </Card>
                    ))}
                </div>

                {/*<div className="max-w-md mx-auto">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Have a coupon code?</h3>
            <div className="flex space-x-3">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1"
              />
              <Button variant="primary" size="sm">
                Apply
              </Button>
            </div>
          </Card>
        </div>*/}
            </div>
        </section>
    );
};

// Reviews Section Component
const ReviewsSection = () => {
    return (
        <section id="reviews" className="relative py-24 px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Success Stories
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Real people, real results. See how RecruiterAI transformed their job search journey.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {reviews.map((review, index) => (
                        <Review review={review} key={index} />
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Card className="p-8 max-w-3xl mx-auto" gradient>
                        <div className="grid md:grid-cols-3 gap-8">
                            <div>
                                <div className="text-3xl font-bold text-white mb-2">87%</div>
                                <div className="text-gray-300">Average Response Rate</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white mb-2">4.9/5</div>
                                <div className="text-gray-300">Customer Satisfaction</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white mb-2">2.3x</div>
                                <div className="text-gray-300">Faster Job Placement</div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
};

// FAQ Section Component
const FAQSection = () => {
    const [openFaq, setOpenFaq] = useState(null);

    const faqs = [
        {
            question: "How does the free test work?",
            answer: "Simply sign up and choose one company you'd like to target. Our AI will analyze your profile, find the best recruiter at that company, and generate one personalized email for free. No credit card required!"
        },
        {
            question: "How long does the AI processing take?",
            answer: "Typically 24 hours for most requests. During peak times, it may take up to 7 days. Premium plans (Pro and Ultra) get priority processing. You'll receive email updates throughout the process."
        },
        {
            question: "Can I edit the generated emails?",
            answer: "Absolutely! While our AI generates highly personalized content, you have full control to review, edit, and customize each email before sending through our dashboard."
        },
        {
            question: "What if I'm not satisfied with the results?",
            answer: "We're confident in our AI's quality, but if you're not satisfied within the first 7 days, we offer a full refund. Our success rate speaks for itself with 87% average response rates."
        },
        {
            question: "Do you provide the recruiter contact information?",
            answer: "Yes! We identify and provide the contact details for the best-matched recruiters at each company, along with insights about their background and preferences."
        },
        {
            question: "How does the follow-up automation work?",
            answer: "Our AI analyzes response patterns and suggests the optimal timing for follow-ups. You'll receive notifications when it's the perfect time to send a follow-up, along with AI-generated follow-up messages."
        },
        {
            question: "Can I cancel or change my plan anytime?",
            answer: "Yes, you can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at your next billing cycle, and we'll prorate any differences."
        },
        {
            question: "Is my data secure and private?",
            answer: "Absolutely. We use enterprise-grade encryption and never share your personal information. Your profile data is only used to generate your personalized emails and is never sold to third parties."
        }
    ];

    return (
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-xl text-gray-400">
                        Everything you need to know about RecruiterAI
                    </p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <Card key={index} className="overflow-hidden" hover={false}>
                            <button
                                className="w-full p-6 text-left focus:outline-none"
                                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                                    <ChevronDown
                                        className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === index ? 'rotate-180' : ''
                                            }`}
                                    />
                                </div>
                            </button>
                            {openFaq === index && (
                                <div className="px-6 pb-6">
                                    <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};

// CTA Section Component
const CTASection = () => {
    const [email, setEmail] = useState('');

    return (
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
                <Card className="p-12" gradient>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent">
                        Ready to Transform Your Job Search?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                        Join thousands of successful job seekers who landed their dream roles with AI-powered personalization.
                        Start with a free test email today.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto mb-8">
                        <Input
                            type="email"
                            placeholder="Enter your email to start"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Button size="lg" className='min-w-48' icon={<ArrowRight className="w-5 h-5" />}>
                            Start Free Test
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4 text-green-400" />
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Award className="w-4 h-4 text-green-400" />
                            <span>87% average response rate</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-green-400" />
                            <span>Setup in 2 minutes</span>
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    );
};

// Footer Component
const Footer = () => {
    return (
        <footer className="relative border-t border-white/10 py-12 px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="grid md:grid-cols-4 gap-8 mb-8">
                    <div className="md:col-span-2">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                RecruiterAI
                            </span>
                        </div>
                        <p className="text-gray-400 max-w-md">
                            Transform your job search with AI-powered personalization. Land your dream job faster with emails that actually get responses.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-white font-semibold mb-4">Product</h3>
                        <ul className="space-y-2 text-gray-400">
                            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                            <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                            <li><a href="#process" className="hover:text-white transition-colors">How it Works</a></li>
                            <li><a href="#reviews" className="hover:text-white transition-colors">Reviews</a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-white font-semibold mb-4">Support</h3>
                        <ul className="space-y-2 text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10">
                    <div className="text-gray-400 mb-4 md:mb-0">
                        &copy; 2024 RecruiterAI. All rights reserved.
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 text-green-400">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-sm">All systems operational</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

// Main Landing Page Component
const LandingPage = () => {
    return (
        <div className="min-h-screen bg-black text-white">
            <HeroSection />
            <StatsSection />
            <SavingsSection />
            <FeaturesSection />
            <ProcessSection />
            <EmailExamplesSection />
            <PricingSection />
            <ReviewsSection />
            <FAQSection />
            <CTASection />
            <Footer />
        </div>
    );
};

export default LandingPage;