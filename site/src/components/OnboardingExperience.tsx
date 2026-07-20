'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Check, Copy, Crown, ExternalLink, Linkedin, Loader2, Mail, RotateCcw, Search, SlidersHorizontal, Sparkles, Target, UserRound } from 'lucide-react'
import { ProfileAnalysisClient, CompanyInputClient } from '@/components/onboarding'
import { PlanSelector, type PlanInfo } from '@/components/PlanSelector'
import { UnifiedCheckout } from '@/components/UnifiedCheckout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { continueFreePreviewToDashboard, startOnboardingRecruiterSearch } from '@/actions/onboarding-actions'
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

function SearchExperience({ preview, replay = false, onReplayComplete }: { preview: OnboardingPreviewState; replay?: boolean; onReplayComplete?: () => void }) {
  const company = preview.company?.name || 'your chosen company'
  const [scene, setScene] = useState(0)
  const [visibleStrategy, setVisibleStrategy] = useState(preview.searchProgress?.strategy || '')
  const latestStrategy = useRef(preview.searchProgress?.strategy || '')
  const lastStrategyChange = useRef(Date.now())
  const minimumReadingTime = 6500

  useEffect(() => {
    const timer = window.setInterval(() => setScene(value => (value + 1) % 5), 7000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!replay) return
    const strategies = preview.replayStrategies?.length
      ? preview.replayStrategies
      : [preview.matchedQuery?.name || preview.searchProgress?.strategy || 'Replaying the successful matching strategy']
    let index = 0
    let cancelled = false
    let timer: number | undefined
    setVisibleStrategy(strategies[0])
    const scheduleNext = () => {
      const readingTime = 4000 + Math.floor(Math.random() * 8001)
      timer = window.setTimeout(() => {
        if (cancelled) return
        if (index === strategies.length - 1) {
          onReplayComplete?.()
          return
        }
        index += 1
        setVisibleStrategy(strategies[index])
        scheduleNext()
      }, readingTime)
    }
    scheduleNext()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [onReplayComplete, preview.matchedQuery?.name, preview.replayStrategies, preview.searchProgress?.strategy, replay])

  useEffect(() => {
    if (replay) return
    latestStrategy.current = preview.searchProgress?.strategy || ''
    if (!latestStrategy.current || latestStrategy.current === visibleStrategy) return
    const remaining = minimumReadingTime - (Date.now() - lastStrategyChange.current)
    const update = () => {
      setVisibleStrategy(latestStrategy.current)
      lastStrategyChange.current = Date.now()
    }
    if (remaining <= 0) update()
    else {
      const timer = window.setTimeout(update, remaining)
      return () => window.clearTimeout(timer)
    }
  }, [preview.searchProgress?.strategy, replay, visibleStrategy])

  const targetRole = preview.searchContext?.targetRole || 'your target role'
  const strengths = preview.searchContext?.strengths || []
  const scenes = [
    <div className="text-center"><p className="text-sm uppercase tracking-[0.22em] text-violet-300">The search has started</p><h2 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-6xl">We know what to look for.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">A contact who can understand your background and the value you could bring as {targetRole}.</p></div>,
    <Card hover={false} className="mx-auto w-full max-w-2xl border-violet-500/20 p-8 sm:p-10"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">What makes you relevant</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{(strengths.length ? strengths : ['Your professional experience', 'Your strongest skills', 'Your target role', 'Your geographic fit']).slice(0, 4).map(item => <div key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-gray-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</div>)}</div><p className="mt-7 text-sm leading-6 text-gray-400">These signals determine which people CandidAI prioritizes.</p></Card>,
    <div className="text-center"><Building2 className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Now mapping {company}’s recruiting team.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">We’re looking beyond generic HR contacts to find someone aligned with your role, seniority, and location.</p></div>,
    <Card hover={false} className="mx-auto w-full max-w-2xl overflow-hidden border-white/10 p-0"><div className="border-b border-white/10 bg-violet-500/10 p-7"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">Why the search takes time</p><h3 className="mt-3 text-2xl font-semibold text-white">Precision takes longer than a simple lookup.</h3></div><div className="space-y-5 p-7 text-sm leading-7 text-gray-300"><p>CandidAI tests each strategy separately, starting with the strongest overlap and relaxing one condition at a time only when necessary.</p><p className="text-gray-500">This prevents the first available contact from automatically becoming your recommended contact.</p></div></Card>,
    <div className="text-center"><Search className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Still looking for someone worth recommending.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">{preview.searchContext?.narrative || `The search remains anchored to your profile while it explores ${company}.`}</p></div>,
  ]

  return <div className="relative mx-auto flex min-h-[640px] max-w-5xl flex-col overflow-hidden">
    {replay && <Button variant="ghost" size="sm" className="absolute right-4 top-0 z-10 text-gray-500" onClick={onReplayComplete}>Back to result</Button>}
    <div className="flex flex-1 items-center justify-center px-4 pb-40">
      <AnimatePresence mode="wait">
        <motion.div key={scene} className="w-full" initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -22, filter: 'blur(8px)' }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>{scenes[scene]}</motion.div>
      </AnimatePresence>
    </div>
    <div className="absolute inset-x-4 bottom-5 sm:inset-x-12">
      <p className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-gray-600">Strategy currently being tested</p>
      <AnimatePresence mode="wait">
        <motion.div key={visibleStrategy || 'initial'} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45 }} className="mx-auto flex max-w-2xl items-center gap-4 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 shadow-2xl backdrop-blur-xl"><span className="relative flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-violet-500" /></span><div className="min-w-0"><p className="truncate font-medium text-white">{visibleStrategy || 'Preparing the most precise strategy'}</p><p className="mt-1 text-xs text-gray-500">Comparing this strategy with the people available at {company}.</p></div></motion.div>
      </AnimatePresence>
    </div>
  </div>
}

function ApplicationAssembly({ preview }: { preview: OnboardingPreviewState }) {
  return <div className="mx-auto max-w-5xl space-y-7">
    <div className="text-center"><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">Best contact found</Badge><h2 className="text-3xl font-bold text-white sm:text-4xl">Your application is taking shape</h2><p className="mt-3 text-gray-400">The match is ready. CandidAI is already writing the email—there’s nothing else you need to enter.</p></div>
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card hover={false} className="p-7 text-left"><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Selected for you</p><p className="mt-5 text-2xl font-semibold text-white">{preview.recruiter?.name}</p><p className="mt-1 text-violet-300">{preview.recruiter?.jobTitle}</p><p className="mt-1 text-sm text-gray-500">{preview.company?.name}</p><Separator className="my-6" /><p className="text-sm font-medium text-white">Why this person</p><p className="mt-2 text-sm leading-6 text-gray-400">This contact emerged from “{preview.matchedQuery?.name || 'the strongest available match'}” after comparing the recruiting team with your profile and location.</p></Card><Card hover={false} className="relative overflow-hidden p-7"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" /><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-gray-500">Your email</p><p className="mt-2 font-medium text-white">Writing a personal introduction to {preview.recruiter?.name?.split(' ')[0] || 'your recruiter'}</p></div><Loader2 className="h-5 w-5 animate-spin text-violet-400" /></div><div className="mt-8 space-y-4"><div className="h-4 w-3/5 animate-pulse rounded bg-white/10" /><div className="h-px bg-white/10" /><div className="h-3 w-full animate-pulse rounded bg-white/10" /><div className="h-3 w-11/12 animate-pulse rounded bg-white/10" /><div className="h-3 w-4/5 animate-pulse rounded bg-white/10" /><div className="pt-3 text-sm text-violet-300"><Sparkles className="mr-2 inline h-4 w-4" />Connecting your experience to {preview.company?.name}</div></div></Card></div>
  </div>
}

function ConversionResult({ preview, email, onReplay }: { preview: OnboardingPreviewState; email?: string; onReplay: () => void }) {
  const [selected, setSelected] = useState<PlanInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const choose = useCallback((plan: PlanInfo) => setSelected(plan), [])
  const recruiter = preview.recruiter
  const profile = preview.recruiterProfile
  const linkedinUrl = recruiter?.linkedinUrl ? (recruiter.linkedinUrl.startsWith('http') ? recruiter.linkedinUrl : `https://${recruiter.linkedinUrl}`) : undefined
  const copyEmail = async () => {
    await navigator.clipboard.writeText(`Subject: ${preview.email?.subject || ''}\n\n${preview.email?.body || ''}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  const openEmailApp = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(preview.email?.subject || '')}&body=${encodeURIComponent(preview.email?.body || '')}`
  }
  return <div className="mx-auto max-w-6xl space-y-12">
    <div className="text-center"><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">First application complete</Badge><h2 className="text-4xl font-bold text-white">Your first application is ready</h2><p className="mx-auto mt-3 max-w-2xl text-gray-400">CandidAI matched your profile with {preview.recruiter?.name} at {preview.company?.name} and wrote a message designed specifically for that connection.</p><Button className="mt-4 text-gray-500 hover:text-gray-200" variant="ghost" size="sm" onClick={onReplay} icon={<RotateCcw className="h-3.5 w-3.5" />}>Replay the research</Button></div>
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card hover={false} className="p-6"><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Selected for you</p><p className="mt-4 text-xl font-semibold text-white">{recruiter?.name}</p><p className="text-sm text-violet-300">{recruiter?.jobTitle}</p>{profile?.location && <p className="mt-1 text-sm text-gray-500">{profile.location}</p>}<Separator className="my-5" /><p className="text-sm leading-6 text-gray-300">{preview.recruiterInsight?.reason || `The strongest verified match found for your profile at ${preview.company?.name}.`}</p><div className="mt-4 space-y-3 text-sm text-gray-400">{(preview.recruiterInsight?.points || preview.email?.keyPoints || []).map(point => <p key={point} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{point}</p>)}</div><div className="mt-6 grid gap-2">{linkedinUrl && <Button variant="secondary" onClick={() => window.open(linkedinUrl, '_blank', 'noopener,noreferrer')} icon={<Linkedin className="h-4 w-4" />}>View on LinkedIn</Button>}<Dialog><DialogTrigger asChild><Button variant="ghost" icon={<UserRound className="h-4 w-4" />}>View full recruiter profile</Button></DialogTrigger><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{recruiter?.name}</DialogTitle><DialogDescription>{recruiter?.jobTitle} · {preview.company?.name}</DialogDescription></DialogHeader><div className="space-y-6 pt-3">{profile?.summary && <p className="text-sm leading-7 text-gray-300">{profile.summary}</p>}{profile?.skills?.length ? <div><p className="text-sm font-medium text-white">Professional signals</p><div className="mt-3 flex flex-wrap gap-2">{profile.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div></div> : null}{profile?.experience?.length ? <div><p className="text-sm font-medium text-white">Recent experience</p><div className="mt-3 space-y-3">{profile.experience.map((item, index) => <div key={`${item.company}-${index}`} className="rounded-xl border border-white/10 p-4"><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-sm text-gray-400">{item.company}</p></div>)}</div></div> : null}{profile?.education?.length ? <div><p className="text-sm font-medium text-white">Education</p><div className="mt-3 space-y-2">{profile.education.map((item, index) => <p key={`${item.school}-${index}`} className="text-sm text-gray-300">{item.degree}{item.degree && item.school ? ' · ' : ''}{item.school}</p>)}</div></div> : null}<div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">Direct recruiter email addresses are not included in the free preview.</div></div></DialogContent></Dialog></div></Card>
      <Card hover={false} className="p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-gray-500">Subject</p><p className="mt-1 font-semibold text-white">{preview.email?.subject}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={copyEmail} icon={<Copy className="h-4 w-4" />}>{copied ? 'Copied' : 'Copy email'}</Button><Button size="sm" onClick={openEmailApp} icon={<ExternalLink className="h-4 w-4" />}>Open in my email app</Button></div></div><Separator className="my-5" /><div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">{preview.email?.body}</div><div className="mt-7 rounded-xl border border-blue-400/20 bg-blue-400/5 p-4 text-sm leading-6 text-blue-100"><strong>Free preview:</strong> the recruiter’s direct email address is not included. You can connect on LinkedIn or open this draft in your email app and add a contact you already have.</div></Card>
    </div>

    <section className="space-y-10 pt-8">
      <div className="text-center"><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Behind this result</p><h3 className="mx-auto mt-4 max-w-3xl text-3xl font-bold text-white sm:text-4xl">This wasn’t a template. It was a complete research process.</h3><p className="mx-auto mt-4 max-w-2xl text-gray-400">For one application, CandidAI connected your professional story, {preview.company?.name}, a recruiter strategy, and a message written for that exact match.</p></div>
      <div className="grid gap-3 md:grid-cols-4">{['Analyzed your professional background', `Mapped ${preview.company?.name}’s recruiting team`, `Selected ${recruiter?.name || 'the strongest contact'}`, 'Wrote a message for that connection'].map((item, index) => <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><span className="text-xs text-violet-300">0{index + 1}</span><p className="mt-3 text-sm leading-6 text-gray-200">{item}</p></div>)}</div>
      <div className="text-center"><h3 className="text-3xl font-bold text-white">You’ve seen what CandidAI can do for one company.</h3><p className="mt-3 text-lg text-gray-400">A plan turns it into a complete outreach system.</p></div>

      <div className="space-y-5">
        <Card hover={false} className="grid gap-7 border-blue-500/20 p-7 md:grid-cols-[220px_1fr] md:p-9"><div><Target className="h-7 w-7 text-blue-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-blue-300">Base · Scale</p><h4 className="mt-2 text-2xl font-semibold text-white">Repeat this for 20 companies.</h4></div><div className="space-y-4 text-sm leading-7 text-gray-300"><p>CandidAI researches a relevant recruiter and writes a different email for every target company.</p><p>Unlike the free preview, every result includes the recruiter’s verified email address.</p><p className="font-medium text-blue-200">From one finished application to a focused outreach campaign.</p></div></Card>
        <Card hover={false} className="grid gap-7 border-violet-500/30 bg-violet-500/[0.04] p-7 md:grid-cols-[220px_1fr] md:p-9"><div><SlidersHorizontal className="h-7 w-7 text-violet-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-violet-300">Pro · Direct</p><h4 className="mt-2 text-2xl font-semibold text-white">Decide who we find and what we say.</h4></div><div className="grid gap-4 sm:grid-cols-2">{[{ title: '30 recruiter criteria', text: 'Choose and prioritize exactly what makes a contact relevant.' }, { title: 'Custom email direction', text: 'Tell CandidAI what to emphasize, include, or avoid in its prompts.' }, { title: 'Follow-up automation', text: 'Continue each conversation with personalized follow-ups and reminders.' }, { title: '1,000 credits', text: 'Refind recruiters, regenerate drafts, replace companies, or run new research.' }].map(item => <div key={item.title} className="rounded-xl border border-white/10 p-4"><p className="font-medium text-white">{item.title}</p><p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p></div>)}</div></Card>
        <Card hover={false} className="grid gap-7 border-amber-500/20 p-7 md:grid-cols-[220px_1fr] md:p-9"><div><Crown className="h-7 w-7 text-amber-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-amber-300">Ultra · Orchestrate</p><h4 className="mt-2 text-2xl font-semibold text-white">Validate the company before spending a generation.</h4></div><div className="space-y-5"><p className="text-sm leading-7 text-gray-300">Before generating anything, CandidAI retrieves a detailed PDL company dossier and lets you confirm it found the company you intended—or replace it first.</p><div className="grid gap-3 sm:grid-cols-2">{['100 target companies', '50 recruiter criteria', 'Detailed company intelligence', 'AI company recommendations', 'Priority generation', '2,500 credits and follow-up automation'].map(item => <p key={item} className="flex gap-2 text-sm text-gray-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />{item}</p>)}</div><p className="text-sm font-medium text-amber-200">Reduce wasted generations before they happen and give CandidAI more context for every decision.</p></div></Card>
      </div>

      <div className="space-y-6 pt-4 text-center"><div><h3 className="text-3xl font-bold text-white">Choose how you want to continue.</h3><p className="mx-auto mt-3 max-w-2xl text-gray-400">Scale with Base, direct the strategy with Pro, or validate and orchestrate the complete campaign with Ultra.</p></div><PlanSelector selectedPlanId={selected?.id} onSelect={choose} onCtaClick={choose} ctaLabel="Continue with this plan" /></div>
    </section>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null) }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-5 sm:p-7">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{selected ? `Continue with ${selected.name}` : 'Complete your purchase'}</DialogTitle>
          <DialogDescription>Secure one-time payment. Your onboarding progress stays saved if you close this window.</DialogDescription>
        </DialogHeader>
        {selected && <div className="pt-2"><UnifiedCheckout purchaseType="plan" itemId={selected.id} email={email || ''} /></div>}
      </DialogContent>
    </Dialog>
    <div className="pt-4 text-center"><form action={continueFreePreviewToDashboard}><Button variant="ghost" type="submit" className="text-sm text-gray-500 hover:text-gray-300">Explore the dashboard for now</Button></form></div>
  </div>
}

export function OnboardingExperience(props: Props) {
  const router = useRouter()
  const [replayingResearch, setReplayingResearch] = useState(false)
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
  const stopReplay = useCallback(() => setReplayingResearch(false), [])
  const replayPreview: OnboardingPreviewState = {
    ...preview,
    stage: 'recruiter_search',
    status: 'running',
    searchProgress: {
      attempt: preview.searchProgress?.attempt || 1,
      total: preview.searchProgress?.total || 1,
      strategy: preview.searchProgress?.strategy || preview.matchedQuery?.name || 'Replaying the successful matching strategy',
    },
  }
  if (replayingResearch && effectiveStage === 'preview_ready') {
    return <div><JourneyHeader stage="recruiter_search" /><SearchExperience preview={replayPreview} replay onReplayComplete={stopReplay} /></div>
  }
  return <div><JourneyHeader stage={effectiveStage} />
    {(effectiveStage === 'profile_source' || effectiveStage === 'profile_review') && <ProfileAnalysisClient userId={props.user.uid} plan="free_trial" initialProfile={props.profile} initialCvUrl={props.cvUrl} flow="guided" />}
    {effectiveStage === 'target_company' && <div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><Badge className="mb-4 border-violet-400/20 bg-violet-400/10 text-violet-200">Choose one real opportunity</Badge><h2 className="text-3xl font-bold text-white sm:text-4xl">Which company would you like to join?</h2><p className="mx-auto mt-3 max-w-xl text-gray-400">One company is enough. Your profile will guide who we look for and how we approach them.</p></div><CompanyInputClient userId={props.user.uid} maxCompanies={1} initialCompanies={props.companies} mode="single-preview" /></div>}
    {effectiveStage === 'recruiter_search' && <SearchExperience preview={preview} />}
    {(effectiveStage === 'recruiter_found' || effectiveStage === 'email_generation') && <ApplicationAssembly preview={preview} />}
    {effectiveStage === 'preview_ready' && <ConversionResult preview={preview} email={props.user.email} onReplay={() => setReplayingResearch(true)} />}
    {preview.status === 'failed' && <Card hover={false} className="mx-auto mt-6 max-w-xl p-6 text-center"><p className="font-semibold text-white">The research was interrupted</p><p className="mt-2 text-sm text-gray-400">{preview.error?.message || 'You can try again without losing your profile or company.'}</p><Button className="mt-5" onClick={() => startOnboardingRecruiterSearch().then(() => router.refresh())}>Try again</Button></Card>}
  </div>
}
