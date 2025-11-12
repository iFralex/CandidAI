"use client"
import React, { useState, useEffect } from 'react';
import {
    Sparkles, Target, Zap, Users, Mail, ArrowRight, Check, Star, Play, X, Menu, Clock,
    TrendingUp, Shield, Award, MessageSquare, BarChart3, Filter, Brain, Eye, Send,
    Calendar, MapPin, Briefcase, ChevronDown, Plus, Edit3, ExternalLink, RefreshCw,
    Building, User, Settings, LogOut, Home, Activity, FileText, Globe, Search,
    CheckCircle, AlertCircle, Loader, Timer, Rocket, Crown, Gift, Wand2
} from 'lucide-react';
import { getServerUser } from '@/lib/server-auth';
import { Card } from './ui/card';
import { plansInfo } from '@/config';

// Plan Selection Component
const PlanSelection = ({ onPlanSelect, onFreeTrial }) => {
    const [selectedPlan, setSelectedPlan] = useState(null);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
                <div className="inline-flex items-center space-x-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-6">
                    <Wand2 className="w-5 h-5 text-violet-400" />
                    <span className="text-gray-300">Welcome to RecruiterAI</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent">
                    Choose Your Success Plan
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Select the perfect plan for your job search journey. Start with our free trial to experience the magic of AI-powered personalization.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {plansInfo.map((plan) => (
                    <Card
                        key={plan.id}
                        className={`p-6 flex flex-col cursor-pointer transition-all duration-300 relative ${selectedPlan === plan.id ? 'ring-2 ring-violet-500 bg-white/10' : ''
                            } ${plan.popular ? 'ring-2 ring-violet-500/50 bg-violet-500/30' : ''}`}
                        onClick={() => setSelectedPlan(plan.id)}
                        gradient={plan.popular}
                    >
                        {plan.popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <Badge variant="primary">{plan.highlight}</Badge>
                            </div>
                        )}

                        <div className="text-center mb-6">
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center mx-auto mb-4 text-white`}>
                                  <plan.icon className="w-8 h-8" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                            <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                            <div className="mb-2">
                                {plan.price === 0 ? (
                                    <span className="text-3xl font-bold text-green-400">FREE</span>
                                ) : (
                                    <>
                                        <span className="text-3xl font-bold text-white">€{plan.price}</span>
                                        <span className="text-gray-400">/mo</span>
                                    </>
                                )}
                            </div>

                            {!plan.popular && plan.price > 0 && (
                                <p className="text-sm text-violet-400">{plan.highlight}</p>
                            )}
                        </div>

                        <ul className="space-y-3 mb-6">
                            {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start space-x-2 text-sm">
                                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-300">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="mt-auto">
                            {selectedPlan === plan.id && (
                                <div className="flex items-center justify-center space-x-2 text-violet-400 mb-3">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm">Selected</span>
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <div className="text-center">
                <Button
                    variant="primary"
                    size="lg"
                    disabled={!selectedPlan}
                    onClick={() => {
                        if (selectedPlan === 'free_trial') {
                            onFreeTrial();
                        } else {
                            onPlanSelect(selectedPlan);
                        }
                    }}
                    icon={<ArrowRight className="w-5 h-5" />}
                >
                    {selectedPlan === 'free_trial' ? 'Start Free Trial' : 'Continue Setup'}
                </Button>

                <p className="text-sm text-gray-500 mt-4">
                    {selectedPlan === 'free_trial'
                        ? 'No credit card required • Perfect for testing our AI'
                        : 'You can change or cancel your plan anytime'}
                </p>
            </div>
        </div>
    );
};

// Company Input Component
const CompanyInput = ({ maxCompanies, onComplete, planType }) => {
    const [companies, setCompanies] = useState(['']);
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const addCompany = () => {
        if (companies.length < maxCompanies) {
            setCompanies([...companies, '']);
        }
    };

    const removeCompany = (index) => {
        if (companies.length > 1) {
            const newCompanies = companies.filter((_, i) => i !== index);
            setCompanies(newCompanies);
        }
    };

    const updateCompany = (index, value) => {
        const newCompanies = [...companies];
        newCompanies[index] = value;
        setCompanies(newCompanies);
    };

    const handleContinue = async () => {
        setLoading(true);
        const validCompanies = companies.filter(company => company.trim() !== '');

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        onComplete({ companies: validCompanies });
        setLoading(false);
    };

    const validCompanies = companies.filter(company => company.trim() !== '');

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                    Add Your Target Companies
                </h2>
                <p className="text-lg text-gray-400">
                    {planType === 'ultra'
                        ? "Add companies by name or let our AI recommend the perfect matches for your profile"
                        : "Add the companies you'd like to target in your job search"
                    }
                </p>
            </div>

            <Card className="p-8 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white">Target Companies</h3>
                    <Badge variant="primary">
                        {validCompanies.length} / {maxCompanies} companies
                    </Badge>
                </div>

                <div className="space-y-4 mb-6">
                    {companies.map((company, index) => (
                        <div key={index} className="flex items-center space-x-4">
                            <div className="flex-1">
                                <Input
                                    placeholder={planType === 'ultra' ? "Company name (e.g., Google, Microsoft)" : "LinkedIn company URL or name"}
                                    value={company}
                                    onChange={(e) => updateCompany(index, e.target.value)}
                                    icon={<Building className="w-4 h-4" />}
                                />
                            </div>
                            {companies.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeCompany(index)}
                                    icon={<X className="w-4 h-4" />}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={addCompany}
                        disabled={companies.length >= maxCompanies}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        Add Company
                    </Button>

                    {planType === 'ultra' && (
                        <Button
                            variant="secondary"
                            icon={<Wand2 className="w-4 h-4" />}
                        >
                            Let AI Recommend
                        </Button>
                    )}
                </div>
            </Card>

            <div className="text-center">
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleContinue}
                    disabled={validCompanies.length === 0}
                    loading={loading}
                    icon={<ArrowRight className="w-5 h-5" />}
                >
                    Continue Setup
                </Button>

                <p className="text-sm text-gray-500 mt-4">
                    You can add more companies later from your dashboard
                </p>
            </div>
        </div>
    );
};

// Profile Analysis Component
const ProfileAnalysis = ({ onComplete }) => {
    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [profileSummary, setProfileSummary] = useState(null);
    const [recruiterPersona, setRecruiterPersona] = useState('');

    const mockProfileSummary = {
        name: "John Doe",
        title: "Senior Frontend Developer",
        experience: "5 years",
        skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
        education: "Computer Science, Stanford University",
        strengths: ["Technical leadership", "Product development", "Team collaboration"]
    };

    const mockRecruiterPersona = "Looking for an experienced Frontend Developer with strong React and TypeScript skills, ideally with leadership experience in fast-paced tech environments. The perfect recruiter would be from innovative companies focusing on user experience and modern web technologies.";

    const analyzeProfile = async () => {
        setAnalyzing(true);

        // Simulate AI analysis
        await new Promise(resolve => setTimeout(resolve, 3000));

        setProfileSummary(mockProfileSummary);
        setRecruiterPersona(mockRecruiterPersona);
        setAnalysisComplete(true);
        setAnalyzing(false);
    };

    const handleContinue = () => {
        onComplete({
            linkedinUrl,
            profileSummary,
            recruiterPersona
        });
    };

    if (!analysisComplete && !analyzing) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Connect Your LinkedIn Profile
                    </h2>
                    <p className="text-lg text-gray-400">
                        Our AI will analyze your profile to understand your background and create the perfect recruiter matching strategy.
                    </p>
                </div>

                <Card className="p-8">
                    <div className="mb-6">
                        <Input
                            label="LinkedIn Profile URL"
                            placeholder="https://www.linkedin.com/in/your-profile"
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            icon={<Globe className="w-4 h-4" />}
                        />
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                        <h3 className="text-blue-400 font-semibold mb-2">🔒 Privacy & Security</h3>
                        <p className="text-gray-300 text-sm">
                            We only read your public profile information to understand your background.
                            We never post, message, or modify anything on your behalf.
                        </p>
                    </div>

                    <div className="text-center">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={analyzeProfile}
                            disabled={!linkedinUrl.trim()}
                            icon={<Brain className="w-5 h-5" />}
                        >
                            Analyze My Profile
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    if (analyzing) {
        return (
            <div className="max-w-3xl mx-auto text-center">
                <Card className="p-12">
                    <div className="mb-8">
                        <div className="w-20 h-20 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Brain className="w-10 h-10 text-white animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Analyzing Your Profile
                        </h2>
                        <p className="text-gray-400">
                            Our AI is studying your background, skills, and experience to create your perfect recruiter matching strategy...
                        </p>
                    </div>

                    <div className="space-y-4 text-left max-w-md mx-auto">
                        {[
                            "Reading profile information...",
                            "Analyzing skills and experience...",
                            "Identifying career patterns...",
                            "Creating recruiter persona..."
                        ].map((step, index) => (
                            <div key={index} className="flex items-center space-x-3 text-gray-300">
                                <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                                <span className="text-sm">{step}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                    Profile Analysis Complete
                </h2>
                <p className="text-lg text-gray-400">
                    Review your profile summary and ideal recruiter persona. You can edit anything before proceeding.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
                <Card className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                        <User className="w-5 h-5 mr-2 text-violet-400" />
                        Your Profile Summary
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-400 mb-1">Name & Title</p>
                            <p className="text-white font-medium">{profileSummary.name}</p>
                            <p className="text-gray-300">{profileSummary.title}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-400 mb-1">Experience</p>
                            <p className="text-gray-300">{profileSummary.experience}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-400 mb-2">Key Skills</p>
                            <div className="flex flex-wrap gap-2">
                                {profileSummary.skills.map((skill, index) => (
                                    <Badge key={index} variant="primary">{skill}</Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm text-gray-400 mb-1">Education</p>
                            <p className="text-gray-300">{profileSummary.education}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                        <Target className="w-5 h-5 mr-2 text-violet-400" />
                        Ideal Recruiter Persona
                    </h3>

                    <div className="mb-4">
                        <textarea
                            value={recruiterPersona}
                            onChange={(e) => setRecruiterPersona(e.target.value)}
                            className="w-full h-32 p-4 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            placeholder="Describe your ideal recruiter..."
                        />
                    </div>

                    <Button variant="ghost" size="sm" icon={<Edit3 className="w-4 h-4" />}>
                        Edit Persona
                    </Button>
                </Card>
            </div>

            <div className="text-center">
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleContinue}
                    icon={<ArrowRight className="w-5 h-5" />}
                >
                    Continue Setup
                </Button>

                <p className="text-sm text-gray-500 mt-4">
                    This information helps us find the perfect recruiters for you
                </p>
            </div>
        </div>
    );
};

// Advanced Filters Component (Pro/Ultra plans)
const AdvancedFilters = ({ planType, onComplete }) => {
    const [filters, setFilters] = useState({
        location: '',
        experience: '',
        industry: '',
        companySize: ''
    });

    const maxFilters = planType === 'ultra' ? 3 : 1;
    const [selectedFilters, setSelectedFilters] = useState([]);

    const availableFilters = [
        { id: 'location', label: 'Location', icon: <MapPin className="w-4 h-4" />, placeholder: 'e.g., San Francisco, Remote' },
        { id: 'experience', label: 'Years of Experience', icon: <Clock className="w-4 h-4" />, placeholder: 'e.g., 3-5 years' },
        { id: 'industry', label: 'Industry Focus', icon: <Building className="w-4 h-4" />, placeholder: 'e.g., FinTech, SaaS' },
        { id: 'companySize', label: 'Company Size', icon: <Users className="w-4 h-4" />, placeholder: 'e.g., Startup, Enterprise' }
    ];

    const toggleFilter = (filterId) => {
        if (selectedFilters.includes(filterId)) {
            setSelectedFilters(selectedFilters.filter(id => id !== filterId));
            setFilters({ ...filters, [filterId]: '' });
        } else if (selectedFilters.length < maxFilters) {
            setSelectedFilters([...selectedFilters, filterId]);
        }
    };

    const updateFilter = (filterId, value) => {
        setFilters({ ...filters, [filterId]: value });
    };

    const handleContinue = () => {
        const activeFilters = {};
        selectedFilters.forEach(filterId => {
            if (filters[filterId].trim()) {
                activeFilters[filterId] = filters[filterId];
            }
        });

        onComplete({ filters: activeFilters });
    };

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

            <Card className="p-8 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white">Filter Options</h3>
                    <Badge variant="primary">
                        {selectedFilters.length} / {maxFilters} filters selected
                    </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {availableFilters.map((filter) => {
                        const isSelected = selectedFilters.includes(filter.id);
                        const isDisabled = !isSelected && selectedFilters.length >= maxFilters;

                        return (
                            <Card
                                key={filter.id}
                                className={`p-6 cursor-pointer transition-all duration-300 ${isSelected ? 'ring-2 ring-violet-500 bg-white/10' : ''
                                    } ${isDisabled ? 'opacity-50' : ''}`}
                                onClick={() => !isDisabled && toggleFilter(filter.id)}
                                hover={!isDisabled}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-400'
                                            }`}>
                                            {filter.icon}
                                        </div>
                                        <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                            {filter.label}
                                        </span>
                                    </div>

                                    {isSelected ? (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />
                                    )}
                                </div>

                                {isSelected && (
                                    <Input
                                        placeholder={filter.placeholder}
                                        value={filters[filter.id]}
                                        onChange={(e) => updateFilter(filter.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                )}
                            </Card>
                        );
                    })}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <h4 className="text-blue-400 font-semibold mb-2">💡 Smart Filtering</h4>
                    <p className="text-gray-300 text-sm">
                        If your filters result in no matches or poor quality matches, our AI will automatically
                        retry without the most restrictive filter to ensure you always get great results.
                    </p>
                </div>
            </Card>

            <div className="text-center">
                <div className="flex items-center justify-center space-x-4">
                    <Button
                        variant="ghost"
                        size="lg"
                        onClick={() => onComplete({ filters: {} })}
                    >
                        Skip Filters
                    </Button>

                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleContinue}
                        icon={<ArrowRight className="w-5 h-5" />}
                    >
                        Continue Setup
                    </Button>
                </div>

                <p className="text-sm text-gray-500 mt-4">
                    You can always modify these filters later from your settings
                </p>
            </div>
        </div>
    );
};

// Setup Complete Component
const SetupComplete = ({ onStartGeneration }) => {
    const [customizations, setCustomizations] = useState({
        tone: 'professional',
        length: 'medium',
        focus: 'experience'
    });

    const toneOptions = [
        { id: 'professional', label: 'Professional', description: 'Formal and business-focused' },
        { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
        { id: 'confident', label: 'Confident', description: 'Bold and assertive' }
    ];

    const lengthOptions = [
        { id: 'short', label: 'Short', description: '2-3 paragraphs, quick read' },
        { id: 'medium', label: 'Medium', description: '3-4 paragraphs, balanced' },
        { id: 'long', label: 'Long', description: '4-5 paragraphs, detailed' }
    ];

    const focusOptions = [
        { id: 'experience', label: 'Experience', description: 'Highlight work history' },
        { id: 'skills', label: 'Skills', description: 'Emphasize technical abilities' },
        { id: 'achievements', label: 'Achievements', description: 'Showcase accomplishments' }
    ];

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

            <div className="space-y-8 mb-8">
                <Card className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Email Tone</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        {toneOptions.map((option) => (
                            <Card
                                key={option.id}
                                className={`p-4 cursor-pointer ${customizations.tone === option.id ? 'ring-2 ring-violet-500 bg-white/10' : ''
                                    }`}
                                onClick={() => setCustomizations({ ...customizations, tone: option.id })}
                            >
                                <h4 className="text-white font-medium mb-2">{option.label}</h4>
                                <p className="text-gray-400 text-sm">{option.description}</p>
                            </Card>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Email Length</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        {lengthOptions.map((option) => (
                            <Card
                                key={option.id}
                                className={`p-4 cursor-pointer ${customizations.length === option.id ? 'ring-2 ring-violet-500 bg-white/10' : ''
                                    }`}
                                onClick={() => setCustomizations({ ...customizations, length: option.id })}
                            >
                                <h4 className="text-white font-medium mb-2">{option.label}</h4>
                                <p className="text-gray-400 text-sm">{option.description}</p>
                            </Card>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Primary Focus</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        {focusOptions.map((option) => (
                            <Card
                                key={option.id}
                                className={`p-4 cursor-pointer ${customizations.focus === option.id ? 'ring-2 ring-violet-500 bg-white/10' : ''
                                    }`}
                                onClick={() => setCustomizations({ ...customizations, focus: option.id })}
                            >
                                <h4 className="text-white font-medium mb-2">{option.label}</h4>
                                <p className="text-gray-400 text-sm">{option.description}</p>
                            </Card>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="text-center">
                <Button
                    variant="success"
                    size="lg"
                    onClick={() => onStartGeneration(customizations)}
                    icon={<Rocket className="w-5 h-5" />}
                >
                    Start Email Generation
                </Button>

                <div className="mt-6 grid md:grid-cols-3 gap-4 text-sm text-gray-400">
                    <div className="flex items-center justify-center space-x-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span>Processing: 24hrs - 7 days</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                        <Mail className="w-4 h-4 text-green-400" />
                        <span>Email updates included</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                        <Shield className="w-4 h-4 text-purple-400" />
                        <span>Premium queue priority</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main Dashboard Container
const Homeboarding = ({user}) => {
    // Mock user document data
    const [userData, setUserData] = useState({
        onboarded: false, // Change to true to skip onboarding
        plan: null,
        setupComplete: false,
        companies: [],
        profileData: null,
        filters: {},
        customizations: {}
    });

    const [currentOnboardingStep, setCurrentOnboardingStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Onboarding flow handlers
    const handlePlanSelect = async (planId) => {
        setLoading(true);
        // Simulate API call to save plan selection
        await new Promise(resolve => setTimeout(resolve, 1000));

        setUserData(prev => ({ ...prev, plan: planId }));
        setCurrentOnboardingStep(2);
        setLoading(false);
    };

    const handleFreeTrial = async () => {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        setUserData(prev => ({ ...prev, plan: 'free_trial' }));
        setCurrentOnboardingStep(2);
        setLoading(false);
    };

    const handleCompanyInput = async (data) => {
        setUserData(prev => ({ ...prev, companies: data.companies }));
        setCurrentOnboardingStep(3);
    };

    const handleProfileAnalysis = async (data) => {
        setUserData(prev => ({ ...prev, profileData: data }));

        // Skip filters for free trial and base plan
        if (userData.plan === 'free_trial' || userData.plan === 'base') {
            setCurrentOnboardingStep(5);
        } else {
            setCurrentOnboardingStep(4);
        }
    };

    const handleAdvancedFilters = async (data) => {
        setUserData(prev => ({ ...prev, filters: data.filters }));
        setCurrentOnboardingStep(5);
    };

    const handleSetupComplete = async (customizations) => {
        setLoading(true);

        // Simulate API call to save all data and start generation
        await new Promise(resolve => setTimeout(resolve, 2000));

        setUserData(prev => ({
            ...prev,
            customizations,
            onboarded: true,
            setupComplete: true
        }));

        setLoading(false);
    };

    // If user is not onboarded, show onboarding flow
    const totalSteps = userData.plan === 'free_trial' || userData.plan === 'base' ? 4 : 5;

    return (
        <>
            {currentOnboardingStep === 1 && (
                <PlanSelection
                    onPlanSelect={handlePlanSelect}
                    onFreeTrial={handleFreeTrial}
                />
            )}

            {currentOnboardingStep === 2 && (
                <CompanyInput
                    maxCompanies={userData.plan === 'free_trial' ? 1 : userData.plan === 'base' ? 25 : userData.plan === 'pro' ? 100 : 200}
                    onComplete={handleCompanyInput}
                    planType={userData.plan}
                />
            )}

            {currentOnboardingStep === 3 && (
                <ProfileAnalysis
                    onComplete={handleProfileAnalysis}
                />
            )}

            {currentOnboardingStep === 4 && (userData.plan === 'pro' || userData.plan === 'ultra') && (
                <AdvancedFilters
                    planType={userData.plan}
                    onComplete={handleAdvancedFilters}
                />
            )}

            {currentOnboardingStep === 5 && (
                <SetupComplete
                    onStartGeneration={handleSetupComplete}
                />
            )}
        </>
    );
};

export default Homeboarding;