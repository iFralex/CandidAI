'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Building2, Check, Clock3, Loader2, Mail, Search, Sparkles, UserRound } from 'lucide-react'
import { ProfileAnalysisClient, CompanyInputClient } from '@/components/onboarding'
import { PlanSelector, type PlanInfo } from '@/components/PlanSelector'
import { UnifiedCheckout } from '@/components/UnifiedCheckout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { continueFreePreviewToDashboard, setOnboardingNotificationPreference, startOnboardingRecruiterSearch } from '@/actions/onboarding-actions'
import type { OnboardingPreviewState, OnboardingStage } from '@/types/onboarding'

type Props = {
  user: { uid: string; email?: string; plan?: string }
  stage: OnboardingStage
  profile?: any
  cvUrl?: string | null
  companies?: { name: string; domain?: string; linkedin_url?: string }[]
  initialPreview: OnboardingPreviewState
}

const journey = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'recruiter', label: 'Contact', icon: Search },
  { key: 'email', label: 'Email', icon: Mail },
]

function JourneyHeader({ stage }: { stage: OnboardingStage }) {
  const active = stage === 'profile_source' || stage === 'profile_review' ? 0
    : stage === 'target_company' ? 1
    : stage === 'recruiter_search' || stage === 'recruiter_found' ? 2 : 3
  return (
    <div className="mx-auto mb-12 max-w-3xl" aria-label="First application progress">
      <div className="mb-3 flex items-center justify-between text-xs text-gray-500"><span>Your first application</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" />Saved automatically</span></div>
      <div className="flex items-center justify-between gap-2">
        {journey.map((item, index) => {
          const Icon = item.icon
          const done = index < active
          const current = index === active
          return <div key={item.key} className="flex flex-1 items-center last:flex-none"><div className="flex flex-col items-center gap-2"><div className={`flex h-10 w-10 items-center justify-center rounded-full border ${done ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : current ? 'border-violet-400 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/5 text-gray-600'}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div><span className={`text-xs ${current ? 'text-white' : 'text-gray-500'}`}>{item.label}</span></div>{index < journey.length - 1 && <div className={`mx-2 mb-6 h-px flex-1 ${index < active ? 'bg-emerald-400/40' : 'bg-white/10'}`} />}</div>
        })}
      </div>
    </div>
  )
}

function usePreview(initial: OnboardingPreviewState, shouldPoll: boolean) {
  const [preview, setPreview] = useState(initial)
  useEffect(() => setPreview(initial), [initial])
  useEffect(() => {
    if (!shouldPoll) return
    let cancelled = false
    const refresh = async () => {
      try {
        const response = await fetch('/api/protected/onboarding-preview', { cache: 'no-store' })
        const data = await response.json()
        if (!cancelled && data.success) setPreview(data.preview)
      } catch { /* the next poll retries */ }
    }
    void refresh()
    const timer = window.setInterval(refresh, 2500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [shouldPoll])
  return preview
}

function SearchExperience({ preview }: { preview: OnboardingPreviewState }) {
  const [emailNotice, setEmailNotice] = useState(false)
  const [browserNotice, setBrowserNotice] = useState(false)
  const company = preview.company?.name || 'your chosen company'
  const queryCount = preview.searchContext?.queryCount || 30
  const totalMatches = preview.searchProgress?.total || queryCount
  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="text-center"><Badge className="mb-4 border-violet-400/20 bg-violet-400/10 text-violet-200">Live research</Badge><h2 className="text-3xl font-bold text-white sm:text-4xl">Finding the person who should meet you at {company}</h2><p className="mx-auto mt-4 max-w-2xl text-gray-400">CandidAI is comparing your background with {company}’s recruiting team. This usually takes about two minutes.</p></div>
    <Card hover={false} className="overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-3 text-white"><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-violet-500" /></span>Researching {company}</CardTitle><CardDescription>{preview.searchProgress?.attempt ? `Testing match ${preview.searchProgress.attempt} of ${totalMatches}: ${preview.searchProgress.strategy || 'progressive search'}` : 'Mapping the recruiting team and preparing the most precise matches first.'}</CardDescription></CardHeader><CardContent className="space-y-5 pb-6"><div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs uppercase tracking-[0.18em] text-gray-500">What guides the search</p><p className="mt-2 text-sm leading-6 text-gray-300">{preview.searchContext?.narrative || 'Your strongest experience, target role, seniority, and geographic fit.'}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-center"><p className="text-2xl font-semibold text-white">{preview.searchProgress?.attempt || 0}</p><p className="text-xs text-gray-500">matches checked</p></div></div><Separator /><div className="flex items-start gap-3 text-sm text-gray-400"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /><p>You can leave this page. Your application is saved and the research will continue.</p></div></CardContent></Card>
    <Card hover={false} className="border-violet-500/20 bg-violet-500/5 p-5"><div className="flex gap-3"><Bell className="h-5 w-5 shrink-0 text-violet-400" /><div className="flex-1"><p className="font-medium text-white">You don’t need to keep this page open</p><p className="mt-1 text-sm text-gray-400">We’ll link you directly to the completed application when it’s ready.</p><div className="mt-4 flex flex-wrap gap-3"><Button variant="secondary" size="sm" disabled={emailNotice} onClick={async () => { await setOnboardingNotificationPreference('email', true); setEmailNotice(true) }}>{emailNotice ? 'Email notification enabled' : 'Email me when it’s ready'}</Button><Button variant="secondary" size="sm" disabled={browserNotice} onClick={async () => { if (!('Notification' in window)) return; const permission = await Notification.requestPermission(); if (permission === 'granted') { localStorage.setItem('candidai-preview-notification', '1'); await setOnboardingNotificationPreference('browser', true); setBrowserNotice(true) } }}>{browserNotice ? 'Device notification enabled' : 'Notify me on this device'}</Button></div></div></div></Card>
  </div>
}

function ApplicationAssembly({ preview }: { preview: OnboardingPreviewState }) {
  return <div className="mx-auto max-w-5xl space-y-7">
    <div className="text-center"><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">Best contact found</Badge><h2 className="text-3xl font-bold text-white sm:text-4xl">Your application is taking shape</h2><p className="mt-3 text-gray-400">The match is ready. CandidAI is already writing the email—there’s nothing else you need to enter.</p></div>
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card hover={false} className="p-7 text-left"><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Selected for you</p><p className="mt-5 text-2xl font-semibold text-white">{preview.recruiter?.name}</p><p className="mt-1 text-violet-300">{preview.recruiter?.jobTitle}</p><p className="mt-1 text-sm text-gray-500">{preview.company?.name}</p><Separator className="my-6" /><p className="text-sm font-medium text-white">Why this person</p><p className="mt-2 text-sm leading-6 text-gray-400">This contact emerged from “{preview.matchedQuery?.name || 'the strongest available match'}” after comparing the recruiting team with your profile and location.</p></Card><Card hover={false} className="relative overflow-hidden p-7"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" /><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-gray-500">Your email</p><p className="mt-2 font-medium text-white">Writing a personal introduction to {preview.recruiter?.name?.split(' ')[0] || 'your recruiter'}</p></div><Loader2 className="h-5 w-5 animate-spin text-violet-400" /></div><div className="mt-8 space-y-4"><div className="h-4 w-3/5 animate-pulse rounded bg-white/10" /><div className="h-px bg-white/10" /><div className="h-3 w-full animate-pulse rounded bg-white/10" /><div className="h-3 w-11/12 animate-pulse rounded bg-white/10" /><div className="h-3 w-4/5 animate-pulse rounded bg-white/10" /><div className="pt-3 text-sm text-violet-300"><Sparkles className="mr-2 inline h-4 w-4" />Connecting your experience to {preview.company?.name}</div></div></Card></div>
  </div>
}

function ConversionResult({ preview, email }: { preview: OnboardingPreviewState; email?: string }) {
  const [selected, setSelected] = useState<PlanInfo | null>(null)
  const checkoutRef = useRef<HTMLDivElement>(null)
  const choose = useCallback((plan: PlanInfo) => { setSelected(plan); window.setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }, [])
  return <div className="mx-auto max-w-6xl space-y-12">
    <div className="text-center"><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">First application complete</Badge><h2 className="text-4xl font-bold text-white">Your first application is ready</h2><p className="mx-auto mt-3 max-w-2xl text-gray-400">CandidAI matched your profile with {preview.recruiter?.name} at {preview.company?.name} and wrote a message designed specifically for that connection.</p></div>
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]"><Card hover={false} className="p-6"><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Selected for you</p><p className="mt-4 text-lg font-semibold text-white">{preview.recruiter?.name}</p><p className="text-sm text-violet-300">{preview.recruiter?.jobTitle}</p><Separator className="my-5" /><p className="text-sm leading-6 text-gray-300">{preview.recruiterInsight?.reason || `The strongest verified match found for your profile at ${preview.company?.name}.`}</p><div className="mt-4 space-y-3 text-sm text-gray-400">{(preview.recruiterInsight?.points || preview.email?.keyPoints || []).map(point => <p key={point} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{point}</p>)}</div></Card><Card hover={false} className="p-6"><p className="text-sm text-gray-500">Subject</p><p className="mt-1 font-semibold text-white">{preview.email?.subject}</p><Separator className="my-5" /><div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">{preview.email?.body}</div></Card></div>
    <section className="space-y-6 text-center"><div className="mx-auto max-w-3xl rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6"><p className="text-sm text-violet-200">For this application, CandidAI analyzed your profile, researched {preview.company?.name}, selected the strongest recruiter match, and wrote a personal email.</p></div><div><h3 className="text-3xl font-bold text-white">One application is ready. Now multiply your opportunities.</h3><p className="mx-auto mt-3 max-w-2xl text-gray-400">Run the same process automatically for every company you want to reach.</p></div><PlanSelector selectedPlanId={selected?.id} onSelect={choose} onCtaClick={choose} ctaLabel="Continue with this plan" /></section>
    {selected && <div ref={checkoutRef} className="scroll-mt-8"><Card hover={false} className="mx-auto max-w-3xl border-violet-500/30 p-6"><UnifiedCheckout purchaseType="plan" itemId={selected.id} email={email || ''} /></Card></div>}
    <div className="pt-4 text-center"><form action={continueFreePreviewToDashboard}><Button variant="ghost" type="submit" className="text-sm text-gray-500 hover:text-gray-300">Explore the dashboard for now</Button></form></div>
  </div>
}

export function OnboardingExperience(props: Props) {
  const router = useRouter()
  const poll = ['recruiter_search', 'recruiter_found', 'email_generation', 'preview_ready'].includes(props.stage)
  const preview = usePreview(props.initialPreview, poll)
  const effectiveStage = (preview.stage || props.stage) as OnboardingStage
  useEffect(() => { if (effectiveStage !== props.stage && ['target_company', 'recruiter_search'].includes(props.stage)) router.refresh() }, [effectiveStage, props.stage, router])
  useEffect(() => {
    if (effectiveStage === 'preview_ready' && typeof window !== 'undefined' && localStorage.getItem('candidai-preview-notification') === '1' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Your first application is ready', { body: `Your email to ${preview.recruiter?.name || 'the selected recruiter'} is ready to review.` })
      localStorage.removeItem('candidai-preview-notification')
    }
  }, [effectiveStage, preview.recruiter?.name])
  return <div><JourneyHeader stage={effectiveStage} />
    {(effectiveStage === 'profile_source' || effectiveStage === 'profile_review') && <ProfileAnalysisClient userId={props.user.uid} plan="free_trial" initialProfile={props.profile} initialCvUrl={props.cvUrl} flow="guided" />}
    {effectiveStage === 'target_company' && <div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><Badge className="mb-4 border-violet-400/20 bg-violet-400/10 text-violet-200">Choose one real opportunity</Badge><h2 className="text-3xl font-bold text-white sm:text-4xl">Which company would you like to join?</h2><p className="mx-auto mt-3 max-w-xl text-gray-400">One company is enough. Your profile will guide who we look for and how we approach them.</p></div><CompanyInputClient userId={props.user.uid} maxCompanies={1} initialCompanies={props.companies} mode="single-preview" /></div>}
    {effectiveStage === 'recruiter_search' && <SearchExperience preview={preview} />}
    {(effectiveStage === 'recruiter_found' || effectiveStage === 'email_generation') && <ApplicationAssembly preview={preview} />}
    {effectiveStage === 'preview_ready' && <ConversionResult preview={preview} email={props.user.email} />}
    {preview.status === 'failed' && <Card hover={false} className="mx-auto mt-6 max-w-xl p-6 text-center"><p className="font-semibold text-white">The research was interrupted</p><p className="mt-2 text-sm text-gray-400">{preview.error?.message || 'You can try again without losing your profile or company.'}</p><Button className="mt-5" onClick={() => startOnboardingRecruiterSearch().then(() => router.refresh())}>Try again</Button></Card>}
  </div>
}
