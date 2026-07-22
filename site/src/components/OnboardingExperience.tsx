'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { BriefcaseBusiness, Building2, Check, Copy, Crown, ExternalLink, GraduationCap, Linkedin, Loader2, Mail, MapPin, Search, SlidersHorizontal, Sparkles, Target, UserRound, Wrench, Zap, Trash2, RefreshCw, ArrowRight, ArrowLeft, Pencil } from 'lucide-react'
import { ProfileAnalysisClient, CompanyInputClient, AdvancedFiltersClientWrapper, SetupCompleteClient } from '@/components/onboarding'
import { ProgressScene } from '@/components/onboarding/ProgressScene'
import { PlanSelector, type PlanInfo } from '@/components/PlanSelector'
import { UnifiedCheckout } from '@/components/UnifiedCheckout'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { CompanyLogo } from '@/components/CompanyLogo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { advanceToProfileReview, choosePostPurchasePreviewAction, continueFreePreviewToDashboard, launchPostPurchaseCampaign, markOnboardingCheckoutOpened, navigatePostPurchaseStage, savePostPurchaseCompanies, savePostPurchaseFilters, savePostPurchaseInstructions, savePostPurchaseProfile, startOnboardingProfileGeneration, startOnboardingRecruiterSearch } from '@/actions/onboarding-actions'
import type { OnboardingPreviewState, OnboardingStage } from '@/types/onboarding'
import { plansData, plansInfo } from '@/config'
import { track } from '@/lib/analytics'

type Props = {
  user: { uid: string; email?: string; plan?: string }
  stage: OnboardingStage
  profile?: any
  cvUrl?: string | null
  companies?: { name: string; domain?: string; linkedin_url?: string }[]
  queries?: any[]
  customizations?: { position_description?: string; instructions?: string }
  maxCompanies?: number
  postPurchaseReturnToReview?: boolean
  filtersCustomized?: boolean
  initialPreview: OnboardingPreviewState
}

const journey = [
  { key: 'details', label: 'Details', icon: UserRound },
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'profile', label: 'Profile', icon: Sparkles },
  { key: 'email', label: 'Email', icon: Mail },
]

// Short statements move quickly; information-dense cards remain long enough
// to be read without rushing.
const searchSceneDurations = [4000, 9000, 4000, 10500, 4000]

function JourneyHeader({ stage }: { stage: OnboardingStage }) {
  const active = stage === 'profile_source' ? 0
    : stage === 'target_company' ? 1
    : stage === 'profile_generating' || stage === 'profile_review' ? 2
    : 3 // recruiter_search / recruiter_found / email_generation / preview_ready — all the automatic build toward the email
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-8 border-b border-white/5 bg-[#08050d]/90 px-4 py-3 backdrop-blur-xl sm:static sm:mx-auto sm:mb-12 sm:max-w-3xl sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none" aria-label="First application progress">
      <div className="mb-2 flex items-center justify-between text-xs sm:hidden"><span className="font-medium text-white">Step {active + 1} of {journey.length} · {journey[active].label}</span><span className="flex items-center gap-1 text-gray-500"><Check className="h-3 w-3 text-emerald-400" /><span className="sr-only">Saved automatically</span>Saved</span></div>
      <div className="mb-3 hidden items-center justify-between text-xs text-gray-500 sm:flex"><span>Your first application</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" />Saved automatically</span></div>
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        {journey.map((item, index) => {
          const Icon = item.icon
          const done = index < active
          const current = index === active
          return <div key={item.key} className="flex flex-1 items-center last:flex-none"><div className="flex flex-col items-center gap-2"><div className={`flex h-8 w-8 items-center justify-center rounded-full border sm:h-10 sm:w-10 ${done ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : current ? 'border-violet-400 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/5 text-gray-600'}`}>{done ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}</div><span className={`hidden text-xs sm:block ${current ? 'text-white' : 'text-gray-500'}`}>{item.label}</span></div>{index < journey.length - 1 && <div className={`mx-1.5 h-px flex-1 sm:mx-2 sm:mb-6 ${index < active ? 'bg-emerald-400/40' : 'bg-white/10'}`} />}</div>
        })}
      </div>
    </div>
  )
}

function usePreview(initial: OnboardingPreviewState, shouldPoll: (preview: OnboardingPreviewState) => boolean) {
  const [preview, setPreview] = useState(initial)
  useEffect(() => setPreview(initial), [initial])
  const pollActive = shouldPoll(preview)
  useEffect(() => {
    if (!pollActive) return
    let cancelled = false
    const refresh = async () => {
      try {
        const response = await fetch('/api/protected/onboarding-preview', { cache: 'no-store' })
        const data = await response.json()
        if (!cancelled && data.success) setPreview(current => ({
          ...data.preview,
          replayStrategies: current.replayStrategies,
          strategyDetails: current.strategyDetails,
        }))
      } catch { /* the next poll retries */ }
    }
    void refresh()
    const timer = window.setInterval(refresh, 2500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [pollActive])
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
    const timer = window.setTimeout(() => setScene(value => (value + 1) % searchSceneDurations.length), searchSceneDurations[scene])
    return () => window.clearTimeout(timer)
  }, [scene])

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
  const visibleDetails = preview.strategyDetails?.[visibleStrategy] || []
  const detailPresentation: Record<string, { label: string; icon: typeof MapPin }> = {
    Seniority: { label: 'The right seniority', icon: UserRound },
    'Relevant skills': { label: 'Your relevant skills', icon: Wrench },
    'Previous companies': { label: 'Your same companies', icon: BriefcaseBusiness },
    Education: { label: 'Your same university', icon: GraduationCap },
    Country: { label: 'Your same country', icon: MapPin },
    Continent: { label: 'Your same region', icon: MapPin },
    'Contact type': { label: 'The right decision-maker', icon: Target },
    'Search scope': { label: 'The strongest company connection', icon: Building2 },
  }
  const scenes = [
    <div className="text-center"><p className="text-sm uppercase tracking-[0.22em] text-violet-300">The search has started</p><h2 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-6xl">We know what to look for.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">A contact who can understand your background and the value you could bring as {targetRole}.</p></div>,
    <Card hover={false} className="mx-auto w-full max-w-2xl border-violet-500/20 p-8 sm:p-10"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">What makes you relevant</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{(strengths.length ? strengths : ['Your professional experience', 'Your strongest skills', 'Your target role', 'Your geographic fit']).slice(0, 4).map(item => <div key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-gray-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</div>)}</div><p className="mt-7 text-sm leading-6 text-gray-400">These signals determine which people CandidAI prioritizes.</p></Card>,
    <div className="text-center"><Building2 className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Now mapping {company}’s recruiting team.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">We’re looking beyond generic HR contacts to find someone aligned with your role, seniority, and location.</p></div>,
    <Card hover={false} className="mx-auto w-full max-w-2xl overflow-hidden border-white/10 p-0"><div className="border-b border-white/10 bg-violet-500/10 p-7"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">Why the search takes time</p><h3 className="mt-3 text-2xl font-semibold text-white">Precision takes longer than a simple lookup.</h3></div><div className="space-y-5 p-7 text-sm leading-7 text-gray-300"><p>CandidAI tests each strategy separately, starting with the strongest overlap and relaxing one condition at a time only when necessary.</p><p className="text-gray-500">This prevents the first available contact from automatically becoming your recommended contact.</p></div></Card>,
    <div className="text-center"><Search className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Still looking for someone worth recommending.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">{preview.searchContext?.narrative || `The search remains anchored to your profile while it explores ${company}.`}</p></div>,
  ]

  return <div className="relative mx-auto flex max-w-5xl flex-col overflow-visible sm:min-h-[680px] sm:overflow-hidden">
    {replay && <Button variant="ghost" size="sm" className="absolute right-4 top-0 z-10 text-gray-500" onClick={onReplayComplete}>Back to result</Button>}
    <motion.div className="relative z-10 mx-auto flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-xl backdrop-blur-xl sm:absolute sm:left-1/2 sm:top-0 sm:-translate-x-1/2" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}><CompanyLogo company={preview.company?.domain || company} maxSize={8} minSize={8} /><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Researching</p><p className="max-w-48 truncate text-sm font-medium text-white">{company}</p></div></motion.div>
    <div className="flex min-h-[430px] items-center justify-center px-1 py-8 sm:min-h-0 sm:flex-1 sm:px-4 sm:py-0 sm:pb-64">
      <AnimatePresence mode="wait">
        <motion.div key={scene} className="w-full" initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -22, filter: 'blur(8px)' }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>{scenes[scene]}</motion.div>
      </AnimatePresence>
    </div>
    <ProgressScene
      title={visibleStrategy || 'Preparing the most precise strategy'}
      subtitle={`Looking for genuine overlap between you and people at ${company}.`}
      phase={visibleStrategy}
      phaseDetails={visibleDetails.map(detail => detailPresentation[detail.label] || { label: detail.label, icon: Sparkles })}
    />
  </div>
}

function ProfileBuildingExperience({ preview }: { preview: OnboardingPreviewState }) {
  const company = preview.company?.name || 'the company you chose'
  const [scene, setScene] = useState(0)
  // What the user actually wants during this wait: reassurance it's working, and a
  // preview of what's coming next — for the company they just chose.
  const scenes = [
    <div key="s0" className="text-center"><p className="text-sm uppercase tracking-[0.22em] text-violet-300">Almost there</p><h2 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-6xl">Shaping your background into a profile.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">We read your experience the way a recruiter would, so what matters about you stands out.</p></div>,
    <div key="s1" className="text-center"><Building2 className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Next, we find your person at {company}.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">Not a generic careers inbox. A real recruiter whose background actually overlaps with yours.</p></div>,
    <div key="s2" className="text-center"><Mail className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Then, a message written for {company}.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">Referencing what they actually do and why you fit, so it never reads like a template.</p></div>,
    <div key="s3" className="text-center"><Target className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">One precise message beats a hundred cold applications.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-400">That's the whole idea: reach the right person at {company}, with something worth replying to.</p></div>,
  ]
  const durations = [4600, 6000, 6000, 6000]
  useEffect(() => {
    const timer = window.setTimeout(() => setScene(value => (value + 1) % scenes.length), durations[scene] || 5500)
    return () => window.clearTimeout(timer)
  }, [scene])
  return <div className="relative mx-auto flex max-w-5xl flex-col overflow-visible sm:min-h-[680px] sm:overflow-hidden">
    <div className="flex min-h-[430px] items-center justify-center px-1 py-8 sm:min-h-0 sm:flex-1 sm:px-4 sm:py-0 sm:pb-64">
      <AnimatePresence mode="wait">
        <motion.div key={scene} className="w-full" initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -22, filter: 'blur(8px)' }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>{scenes[scene]}</motion.div>
      </AnimatePresence>
    </div>
    <ProgressScene
      title={preview.profileProgress || 'Reading your CV'}
      subtitle={`Preparing your outreach to ${company}.`}
      phase={preview.profileProgress || 'Reading your CV'}
    />
  </div>
}

function ApplicationAssembly({ preview }: { preview: OnboardingPreviewState }) {
  return <motion.div className="mx-auto flex min-h-[590px] max-w-3xl flex-col items-center justify-center text-center" initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -32, filter: 'blur(10px)' }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}><div className="mx-auto mb-5 w-fit rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-2 shadow-2xl shadow-emerald-500/10"><CompanyLogo company={preview.company?.domain || preview.company?.name} maxSize={14} minSize={14} /></div><p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Match found at {preview.company?.name}</p><h2 className="mt-4 text-3xl font-bold text-white sm:text-5xl">The best recruiter for you is</h2></motion.div>
    <motion.div layout layoutId="onboarding-recruiter-card" className="mt-8 w-full" initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}><Card hover={false} className="mx-auto max-w-xl border-emerald-400/20 p-7 sm:p-9"><ProfileAvatar name={preview.recruiter?.name} imageUrl={preview.recruiterProfile?.avatarUrl} size="lg" className="mx-auto" /><p className="mt-5 text-2xl font-semibold text-white">{preview.recruiter?.name}</p><p className="mt-1 text-violet-300">{preview.recruiter?.jobTitle}</p><Separator className="my-6" /><p className="text-sm leading-7 text-gray-300">{preview.recruiterInsight?.reason || `This person emerged from the strongest match between your background and ${preview.company?.name}’s team, using “${preview.matchedQuery?.name || 'the best available strategy'}”.`}</p></Card></motion.div>
    <motion.div className="mt-7 flex items-center gap-2 text-sm text-gray-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.15, duration: 0.5 }}><Loader2 className="h-4 w-4 animate-spin text-violet-400" />Generating your personalized email…</motion.div>
  </motion.div>
}

function EmailDeliveryReveal({ preview }: { preview: OnboardingPreviewState }) {
  const [emailVisible, setEmailVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const paragraphs = (preview.email?.body || '').split(/\n\s*\n/).filter(Boolean).slice(0, 3)

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setReady(true), 650)
    const emailTimer = window.setTimeout(() => setEmailVisible(true), 1450)
    return () => {
      window.clearTimeout(readyTimer)
      window.clearTimeout(emailTimer)
    }
  }, [])

  return <motion.div className="mx-auto flex min-h-[650px] max-w-5xl flex-col justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}>
    <div className="mb-9 text-center">
      <AnimatePresence mode="wait">
        {!ready ? <motion.div key="finishing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin text-violet-400" />Finishing your introduction…</motion.div> : <motion.div key="ready" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55 }}><div className="mx-auto flex w-fit items-center gap-3"><CompanyLogo company={preview.company?.domain || preview.company?.name} maxSize={11} minSize={11} /><motion.div className="h-px w-8 bg-gradient-to-r from-violet-400 to-emerald-400" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.25, duration: 0.45 }} /><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-5 w-5" /></div></div><p className="mt-4 text-xs uppercase tracking-[0.18em] text-gray-500">Prepared for {preview.company?.name}</p><h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Your introduction is ready.</h2></motion.div>}
      </AnimatePresence>
    </div>

    <motion.div layout className={emailVisible ? 'grid items-stretch gap-5 lg:grid-cols-[280px_1fr]' : 'flex justify-center'} transition={{ layout: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}>
      <motion.div layout layoutId="onboarding-recruiter-card" className="w-full max-w-[360px]" transition={{ layout: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}>
        <Card hover={false} className="flex h-full flex-col items-center justify-center border-emerald-400/20 p-6 text-center">
          <ProfileAvatar name={preview.recruiter?.name} imageUrl={preview.recruiterProfile?.avatarUrl} size="sm" />
          <p className="mt-4 text-lg font-semibold text-white">{preview.recruiter?.name}</p>
          <p className="mt-1 text-sm text-violet-300">{preview.recruiter?.jobTitle}</p>
          <motion.div initial={{ scaleY: 0 }} animate={emailVisible ? { scaleY: 1 } : { scaleY: 0 }} className="mt-5 h-10 w-px origin-top bg-gradient-to-b from-violet-400/70 to-transparent lg:hidden" />
        </Card>
      </motion.div>

      <AnimatePresence>
        {emailVisible && <motion.div layout layoutId="onboarding-email-card" initial={{ opacity: 0, x: 38, rotateY: -4, filter: 'blur(8px)' }} animate={{ opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }} className="relative">
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15, duration: 0.65 }} className="absolute -left-5 top-1/2 hidden h-px w-5 origin-left bg-gradient-to-r from-violet-500 to-violet-300 lg:block" />
          <Card hover={false} className="relative h-full overflow-hidden border-violet-400/25 p-6 text-left sm:p-8">
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9 }} className="absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-violet-500 via-fuchsia-300 to-transparent" />
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}><p className="text-xs uppercase tracking-[0.16em] text-gray-500">Subject</p><p className="mt-2 font-semibold text-white">{preview.email?.subject}</p></motion.div>
            <Separator className="my-5" />
            <div className="space-y-3 text-sm leading-6 text-gray-300">{paragraphs.map((paragraph, index) => <motion.p key={`${index}-${paragraph.slice(0, 20)}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + index * 0.3, duration: 0.45 }} className={index === paragraphs.length - 1 ? 'line-clamp-2' : ''}>{paragraph}</motion.p>)}</div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + paragraphs.length * 0.3 }} className="mt-6 flex gap-2"><span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">Copy email</span><span className="rounded-lg bg-violet-500 px-3 py-2 text-xs text-white">Open in email app</span></motion.div>
          </Card>
        </motion.div>}
      </AnimatePresence>
    </motion.div>
  </motion.div>
}

function ConversionResult({ preview, email }: { preview: OnboardingPreviewState; email?: string }) {
  const [selected, setSelected] = useState<PlanInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const choose = useCallback((plan: PlanInfo) => {
    setSelected(plan)
    track({ name: 'preview_checkout_opened', params: { plan_id: plan.id } })
    void markOnboardingCheckoutOpened(plan.id)
  }, [])
  const recruiter = preview.recruiter
  const profile = preview.recruiterProfile
  const emailParagraphs = (preview.email?.body || '').split(/\n\s*\n/).filter(Boolean)
  const linkedinUrl = recruiter?.linkedinUrl ? (recruiter.linkedinUrl.startsWith('http') ? recruiter.linkedinUrl : `https://${recruiter.linkedinUrl}`) : undefined
  const copyEmail = async () => {
    await navigator.clipboard.writeText(`Subject: ${preview.email?.subject || ''}\n\n${preview.email?.body || ''}`)
    setCopied(true)
    track({ name: 'preview_email_copied', params: { company_name: preview.company?.name || 'unknown' } })
    window.setTimeout(() => setCopied(false), 1800)
  }
  const openEmailApp = () => {
    track({ name: 'preview_email_client_opened', params: { company_name: preview.company?.name || 'unknown' } })
    window.location.href = `mailto:?subject=${encodeURIComponent(preview.email?.subject || '')}&body=${encodeURIComponent(preview.email?.body || '')}`
  }
  return <motion.div className="mx-auto max-w-6xl space-y-12" initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
    <div className="text-center"><motion.div className="mx-auto mb-5 w-fit rounded-2xl border border-white/10 bg-white/[0.035] p-2 shadow-2xl" initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.55 }}><CompanyLogo company={preview.company?.domain || preview.company?.name} maxSize={14} minSize={14} /></motion.div><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">First application complete</Badge><h2 className="text-4xl font-bold text-white">Your first application is ready</h2><p className="mx-auto mt-3 max-w-2xl text-gray-400">CandidAI matched your profile with {preview.recruiter?.name} at {preview.company?.name} and wrote a message designed specifically for that connection.</p></div>
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <motion.div layout layoutId="onboarding-recruiter-card"><Card hover={false} className="h-full p-6"><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Selected for you</p><p className="mt-4 text-xl font-semibold text-white">{recruiter?.name}</p><p className="text-sm text-violet-300">{recruiter?.jobTitle}</p>{(profile?.country || profile?.location) && <p className="mt-1 text-sm text-gray-500">{profile?.country || profile?.location}</p>}<Separator className="my-5" /><p className="text-sm leading-6 text-gray-300">{preview.recruiterInsight?.reason || `The strongest verified match found for your profile at ${preview.company?.name}.`}</p><div className="mt-4 space-y-3 text-sm text-gray-400">{(preview.recruiterInsight?.points || preview.email?.keyPoints || []).map(point => <p key={point} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{point}</p>)}</div><div className="mt-6 grid gap-2">{linkedinUrl && <Button variant="secondary" onClick={() => window.open(linkedinUrl, '_blank', 'noopener,noreferrer')} icon={<Linkedin className="h-4 w-4" />}>View on LinkedIn</Button>}<Dialog><DialogTrigger asChild><Button variant="ghost" icon={<UserRound className="h-4 w-4" />}>View full recruiter profile</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-2xl"><DialogHeader><DialogTitle>{recruiter?.name}</DialogTitle><DialogDescription>{recruiter?.jobTitle} · {preview.company?.name}</DialogDescription></DialogHeader><ScrollArea className="no-scrollbar overflow-y-auto max-h-[calc(90vh-90px)]"><div className="space-y-6 pt-3">{profile?.summary && <p className="text-sm leading-7 text-gray-300">{profile.summary}</p>}{profile?.skills?.length ? <div><p className="text-sm font-medium text-white">Professional signals</p><div className="mt-3 flex flex-wrap gap-2">{profile.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div></div> : null}{profile?.experience?.length ? <div><p className="text-sm font-medium text-white">Recent experience</p><div className="mt-3 space-y-3">{profile.experience.map((item, index) => <div key={`${item.company}-${index}`} className="rounded-xl border border-white/10 p-4"><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-sm text-gray-400">{item.company}</p></div>)}</div></div> : null}{profile?.education?.length ? <div><p className="text-sm font-medium text-white">Education</p><div className="mt-3 space-y-2">{profile.education.map((item, index) => <p key={`${item.school}-${index}`} className="text-sm text-gray-300">{item.degree}{item.degree && item.school ? ' · ' : ''}{item.school}</p>)}</div></div> : null}<div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">Direct recruiter email addresses are not included in the free preview.</div></div></ScrollArea></DialogContent></Dialog></div></Card></motion.div>
      <motion.div layout layoutId="onboarding-email-card"><Card hover={false} className="h-full p-6 sm:p-8"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-gray-500">Subject</p><p className="mt-1 font-semibold text-white">{preview.email?.subject}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={copyEmail} icon={<Copy className="h-4 w-4" />}>{copied ? 'Copied' : 'Copy email'}</Button><Button size="sm" onClick={openEmailApp} icon={<ExternalLink className="h-4 w-4" />}>Open in my email app</Button></div></motion.div><Separator className="my-5" /><div className="space-y-4 text-sm leading-7 text-gray-300">{emailParagraphs.map((paragraph, index) => <motion.p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-pre-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + index * 0.22, duration: 0.5 }}>{paragraph}</motion.p>)}</div><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + emailParagraphs.length * 0.22 }} className="mt-7 space-y-3"><div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4 text-sm leading-6 text-blue-100"><strong>Free preview:</strong> the recruiter’s direct email address is not included. You can connect on LinkedIn or open this draft in your email app and add a contact you already have.</div><div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100"><strong>Built for speed:</strong> this real-time preview skipped the deeper search for company articles most relevant to your profile. Final campaign emails can use that additional research, so the finished result may be even stronger.</div></motion.div></Card></motion.div>
    </div>

    <section className="space-y-8 pt-4 sm:space-y-10 sm:pt-8">
      <div className="hidden sm:block"><div className="text-center"><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Behind this result</p><h3 className="mx-auto mt-4 max-w-3xl text-3xl font-bold text-white sm:text-4xl">This wasn’t a template. It was a complete research process.</h3><p className="mx-auto mt-4 max-w-2xl text-gray-400">For one application, CandidAI connected your professional story, {preview.company?.name}, a recruiter strategy, and a message written for that exact match.</p></div>
      <div className="mt-10 grid gap-3 md:grid-cols-4">{['Analyzed your professional background', `Mapped ${preview.company?.name}’s recruiting team`, `Selected ${recruiter?.name || 'the strongest contact'}`, 'Wrote a message for that connection'].map((item, index) => <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><span className="text-xs text-violet-300">0{index + 1}</span><p className="mt-3 text-sm leading-6 text-gray-200">{item}</p></div>)}</div>
      <div className="mt-10 text-center"><h3 className="text-3xl font-bold text-white">You’ve seen what CandidAI can do for one company.</h3><p className="mt-3 text-lg text-gray-400">A plan turns it into a complete outreach system.</p></div></div>

      <div className="space-y-4 sm:hidden">
        <div className="text-center"><p className="text-xs uppercase tracking-[0.2em] text-violet-300">From one result to a campaign</p><h3 className="mt-3 text-2xl font-bold text-white">Scale what just worked.</h3><p className="mt-2 text-sm leading-6 text-gray-400">The research behind {preview.company?.name} can run across every company you genuinely want.</p></div>
        <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-white"><span>What happened behind this email</span><span className="text-violet-300 transition group-open:rotate-45">+</span></summary><div className="mt-4 space-y-3 border-t border-white/10 pt-4">{['Analyzed your profile', `Mapped ${preview.company?.name}’s team`, `Selected ${recruiter?.name || 'the strongest contact'}`, 'Wrote for that exact connection'].map(item => <p key={item} className="flex gap-2 text-sm text-gray-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</p>)}</div></details>
      </div>

      <div className="hidden space-y-5 sm:block">
        <Card hover={false} className="grid gap-7 border-blue-500/20 p-7 md:grid-cols-[220px_1fr] md:p-9"><div><Target className="h-7 w-7 text-blue-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-blue-300">Base · Scale</p><h4 className="mt-2 text-2xl font-semibold text-white">Repeat this for 20 companies.</h4></div><div className="space-y-4 text-sm leading-7 text-gray-300"><p>CandidAI researches a relevant recruiter and writes a different email for every target company.</p><p>Unlike the free preview, every result includes the recruiter’s verified email address.</p><p className="font-medium text-blue-200">From one finished application to a focused outreach campaign.</p></div></Card>
        <Card hover={false} className="grid gap-7 border-violet-500/30 bg-violet-500/[0.04] p-7 md:grid-cols-[220px_1fr] md:p-9"><div><SlidersHorizontal className="h-7 w-7 text-violet-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-violet-300">Pro · Direct</p><h4 className="mt-2 text-2xl font-semibold text-white">Decide who we find and what we say.</h4></div><div className="grid gap-4 sm:grid-cols-2">{[{ title: '30 recruiter criteria', text: 'Choose and prioritize exactly what makes a contact relevant.' }, { title: 'Custom email direction', text: 'Tell CandidAI what to emphasize, include, or avoid in its prompts.' }, { title: 'Follow-up automation', text: 'Continue each conversation with personalized follow-ups and reminders.' }, { title: '1,000 credits', text: 'Refind recruiters, regenerate drafts, replace companies, or run new research.' }].map(item => <div key={item.title} className="rounded-xl border border-white/10 p-4"><p className="font-medium text-white">{item.title}</p><p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p></div>)}</div></Card>
        <Card hover={false} className="grid gap-7 border-amber-500/20 p-7 md:grid-cols-[220px_1fr] md:p-9"><div><Crown className="h-7 w-7 text-amber-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-amber-300">Ultra · Orchestrate</p><h4 className="mt-2 text-2xl font-semibold text-white">Validate and direct every company individually.</h4></div><div className="space-y-5"><p className="text-sm leading-7 text-gray-300">Before generating anything, CandidAI retrieves a detailed PDL company dossier and lets you confirm it found the company you intended—or replace it first. At that moment, you can also customize recruiter strategies and writing instructions for that company alone.</p><div className="grid gap-3 sm:grid-cols-2">{['100 target companies', '50 recruiter criteria', 'Per-company recruiter strategies', 'Per-company custom instructions', 'Detailed company intelligence', 'AI company recommendations', 'Priority generation', '2,500 credits and follow-up automation'].map(item => <p key={item} className="flex gap-2 text-sm text-gray-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />{item}</p>)}</div><p className="text-sm font-medium text-amber-200">Validate the target, then give every company its own search logic and editorial direction before spending a generation.</p></div></Card>
      </div>

      <div className="space-y-6 pt-2 text-center sm:pt-4"><div><h3 className="text-2xl font-bold text-white sm:text-3xl">Choose how you want to continue.</h3><p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">Scale with Base, direct the strategy with Pro, or validate and orchestrate the complete campaign with Ultra.</p></div><PlanSelector selectedPlanId={selected?.id} onSelect={choose} onCtaClick={choose} ctaLabel="Continue with this plan" mobileCarousel /></div>
    </section>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null) }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl p-5 sm:max-w-5xl sm:p-7">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{selected ? `Continue with ${selected.name}` : 'Complete your purchase'}</DialogTitle>
          <DialogDescription>Secure one-time payment. Your progress stays saved if you close this window.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="no-scrollbar overflow-y-auto max-h-[calc(92vh-120px)]">
          {selected && <div className="pt-2"><UnifiedCheckout purchaseType="plan" itemId={selected.id} email={email || ''} /></div>}
        </ScrollArea>
      </DialogContent>
    </Dialog>
    <div className="pt-4 text-center"><form action={continueFreePreviewToDashboard}><Button variant="ghost" type="submit" className="text-sm text-gray-500 hover:text-gray-300">Explore the dashboard for now</Button></form></div>
  </motion.div>
}

const postPurchaseStages: OnboardingStage[] = ['post_purchase', 'post_purchase_profile', 'post_purchase_companies', 'post_purchase_filters', 'post_purchase_instructions', 'post_purchase_review']

function ActivationChapter({ step, label, title, story, signal, onBack, backPending, hasUnsavedChanges, children }: { step: number; label: string; title: string; story: string; signal: string; onBack?: () => void; backPending?: boolean; hasUnsavedChanges?: boolean; children: React.ReactNode }) {
  const chapters = ['Your profile', 'Targets', 'Recruiter strategy', 'Message direction', 'Launch']
  const [confirmBackOpen, setConfirmBackOpen] = useState(false)
  const goBack = () => {
    if (hasUnsavedChanges) { setConfirmBackOpen(true); return }
    onBack?.()
  }
  return <div className="mx-auto max-w-5xl space-y-8">{onBack && <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" size="sm" onClick={goBack} disabled={backPending} icon={backPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}>Back</Button>{hasUnsavedChanges && <span className="text-xs text-amber-300">Unsaved changes will be lost.</span>}</div>}<div className="grid gap-7 lg:grid-cols-[1fr_300px] lg:items-end"><div><p className="text-xs uppercase tracking-[0.2em] text-violet-300">Chapter {step} · {label}</p><h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-gray-400">{story}</p></div><Card hover={false} className="border-violet-400/20 bg-violet-500/[0.05] p-5"><Sparkles className="h-5 w-5 text-violet-300" /><p className="mt-3 text-xs uppercase tracking-[0.16em] text-gray-500">What this changes</p><p className="mt-2 text-sm leading-6 text-gray-200">{signal}</p></Card></div><div className="flex items-center gap-2">{chapters.map((chapter, index) => <div key={chapter} className="flex flex-1 items-center gap-2"><div className={`h-1.5 flex-1 rounded-full ${index + 1 <= step ? 'bg-violet-500' : 'bg-white/10'}`} /><span className={`hidden text-[10px] sm:block ${index + 1 === step ? 'text-violet-300' : 'text-gray-600'}`}>{chapter}</span></div>)}</div>{children}<Dialog open={confirmBackOpen} onOpenChange={setConfirmBackOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Discard unsaved changes?</DialogTitle><DialogDescription>The changes on this page have not been saved. Going back will permanently discard them.</DialogDescription></DialogHeader><div className="flex justify-end gap-3 pt-3"><Button variant="secondary" onClick={() => setConfirmBackOpen(false)}>Keep editing</Button><Button variant="destructive" onClick={() => { setConfirmBackOpen(false); onBack?.() }}>Discard and go back</Button></div></DialogContent></Dialog></div>
}

function PostPurchaseExperience({ props, preview, onNavigate }: { props: Props; preview: OnboardingPreviewState; onNavigate: (stage: OnboardingStage, returnToReview?: boolean) => Promise<void> }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [profileChanged, setProfileChanged] = useState(false)
  const [rebuildStrategies, setRebuildStrategies] = useState(true)
  const plan = props.user.plan || 'base'
  const planInfo = plansInfo.find(item => item.id === plan)
  const planData = plansData[plan as keyof typeof plansData]
  const maxCompanies = props.maxCompanies || planData?.maxCompanies || 1
  const previewCompanyName = preview.company?.name || props.companies?.[0]?.name || 'your preview company'
  const run = async (key: string, action: () => Promise<unknown>) => {
    setPending(key); setError('')
    try {
      await action()
      if (key !== 'launch') track({ name: 'post_purchase_section_edited', params: { section: key } })
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') } finally { setPending(null) }
  }
  const moveTo = async (nextStage: OnboardingStage, shouldReturnToReview = false) => {
    setPending(`move-${nextStage}`); setError('')
    try {
      await onNavigate(nextStage, shouldReturnToReview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setPending(null) }
  }
  const backTo = (previousStage: OnboardingStage) => props.postPurchaseReturnToReview ? moveTo('post_purchase_review') : moveTo(previousStage)
  useEffect(() => { setHasUnsavedChanges(false); setProfileChanged(false) }, [props.stage])
  if (props.stage === 'post_purchase') return <motion.div className="mx-auto max-w-5xl space-y-9" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
    <div className="text-center"><motion.div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-2xl shadow-emerald-500/20" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}><Check className="h-9 w-9" /></motion.div><Badge className="mt-6 bg-emerald-500/15 text-emerald-300">Purchase confirmed</Badge><h1 className="mt-4 text-4xl font-bold text-white sm:text-5xl">Thank you. {planInfo?.name} is now yours.</h1><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-400">Your first application proved the process. Now let&apos;s rebuild it with your paid-plan settings and turn it into a complete campaign.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[`${planData?.maxCompanies || 0} target companies`, planData?.recruiterStrategy ? `Up to ${planData.recruiterStrategy} recruiter criteria` : 'Verified recruiter emails', planData?.credits ? `${planData.credits.toLocaleString()} credits` : 'Company-by-company outreach', planData?.deepDiveReports ? 'Detailed company intelligence' : planData?.revealRecruiterEmail ? 'Direct contact details' : 'Personalized generation'].map((item, index) => <motion.div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + index * 0.1 }}><span className="text-xs text-violet-300">0{index + 1}</span><p className="mt-3 text-sm font-medium text-white">{item}</p></motion.div>)}</div>
    <Card hover={false} className="border-violet-400/25 p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Decide what happens to {previewCompanyName}</p><h2 className="mt-3 text-2xl font-semibold text-white">Your preview was created before these settings existed.</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">It used the fast preview path, without deeper company research, your new recruiter criteria, custom instructions, or a verified recruiter email. The definitive campaign will start this target from scratch.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><button disabled={Boolean(pending)} onClick={() => run('regenerate', () => choosePostPurchasePreviewAction('regenerate'))} className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-5 text-left transition hover:bg-violet-500/15 disabled:opacity-50"><RefreshCw className="h-5 w-5 text-violet-300" /><p className="mt-4 font-semibold text-white">Keep {previewCompanyName} and start over</p><p className="mt-2 text-sm leading-6 text-gray-400">Save the free email as Version 1, then redo company research, recruiter selection, contact discovery, and writing with your new setup.</p></button><button disabled={Boolean(pending)} onClick={() => run('replace', () => choosePostPurchasePreviewAction('replace'))} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left transition hover:border-red-400/25 hover:bg-red-500/5 disabled:opacity-50"><Trash2 className="h-5 w-5 text-gray-400" /><p className="mt-4 font-semibold text-white">Replace {previewCompanyName}</p><p className="mt-2 text-sm leading-6 text-gray-400">Discard its preview result, free the slot, and build your campaign around a different target.</p></button></div>{pending && <p className="mt-4 flex items-center gap-2 text-sm text-violet-300"><Loader2 className="h-4 w-4 animate-spin" />Preparing your campaign...</p>}{error && <p className="mt-4 text-sm text-red-300">{error}</p>}</Card>
  </motion.div>
  if (props.stage === 'post_purchase_profile') return <ActivationChapter step={1} label="Strengthen the source" title="Before we search, make sure this is the story you want us to carry." story="Every recruiter strategy and every email begins here. Improve the profile now and decide whether its new evidence should rebuild your recruiter strategy." signal="Your profile can regenerate the ordered recruiter strategies before you review them, or leave your existing filters untouched." onBack={() => backTo('post_purchase')} backPending={Boolean(pending)} hasUnsavedChanges={hasUnsavedChanges}><ProfileAnalysisClient userId={props.user.uid} plan={plan} initialProfile={props.profile} initialCvUrl={props.cvUrl} flow="guided" onDirtyChange={dirty => { setHasUnsavedChanges(dirty); setProfileChanged(dirty) }} strategyResetControl={{ enabled: Boolean(props.filtersCustomized), rebuild: rebuildStrategies, onChange: setRebuildStrategies }} onSave={async (savedPlan, data, cv) => { await savePostPurchaseProfile(savedPlan, data, cv, rebuildStrategies && profileChanged); router.refresh() }} /></ActivationChapter>
  if (props.stage === 'post_purchase_companies') return <ActivationChapter step={2} label="Set the map" title="Choose where this campaign should create openings." story="Each company becomes its own research track: a team to understand, a recruiter to earn attention from, and a message that cannot be reused anywhere else." signal={`Your ${planInfo?.name} plan can open up to ${maxCompanies} company tracks. Start with the ones you would genuinely accept a conversation from.`} onBack={() => backTo('post_purchase_profile')} backPending={Boolean(pending)} hasUnsavedChanges={hasUnsavedChanges}><CompanyInputClient userId={props.user.uid} maxCompanies={maxCompanies} initialCompanies={props.companies} planType={plan} isUltraPlan={plan === 'ultra'} mode="campaign-setup" onDirtyChange={setHasUnsavedChanges} onSave={savePostPurchaseCompanies} /></ActivationChapter>
  if (props.stage === 'post_purchase_filters') return <ActivationChapter step={3} label="Shape the search" title="Teach the search what a valuable introduction looks like." story={`Your improved profile has produced ${props.queries?.length || 0} ordered strategies. They move from precise common ground toward broader recruiter signals until the right person emerges.`} signal="Changing these filters changes who CandidAI considers worth contacting, not merely what appears in a form." onBack={() => backTo('post_purchase_companies')} backPending={Boolean(pending)} hasUnsavedChanges={hasUnsavedChanges}><AdvancedFiltersClientWrapper userId={props.user.uid} maxStrategies={plan === 'ultra' ? 50 : 30} defaultStrategy={props.queries || []} plan={plan} onDirtyChange={setHasUnsavedChanges} onSave={async queries => { await savePostPurchaseFilters(queries); router.refresh() }} /></ActivationChapter>
  if (props.stage === 'post_purchase_instructions') return <ActivationChapter step={4} label="Give it a voice" title="Give every message a reason to exist." story="The role defines the destination. Your instructions define the editorial judgment used to connect your strongest evidence with each company's reality." signal={plan === 'pro' || plan === 'ultra' ? 'These directions enter every generation, while company research keeps each final email distinct.' : 'Your target role becomes the common thread across every company-specific email.'} onBack={() => backTo(plan === 'pro' || plan === 'ultra' ? 'post_purchase_filters' : 'post_purchase_companies')} backPending={Boolean(pending)} hasUnsavedChanges={hasUnsavedChanges}><SetupCompleteClient userId={props.user.uid} defaultCustomizations={props.customizations} plan={plan} flow="activation" onDirtyChange={setHasUnsavedChanges} onSave={async data => { await savePostPurchaseInstructions(data); router.refresh() }} /></ActivationChapter>
  return <ActivationChapter step={5} label="Commit the campaign" title="Your campaign is assembled. See exactly where it is going." story="Your profile supplies the evidence. Every target below opens a separate research path, with its own recruiter selection and company-specific message." signal="Launching hands this complete campaign brief to the production pipeline. Nothing starts before you confirm.">
    <Card hover={false} className="overflow-hidden border-blue-400/20 p-0"><div className="border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-violet-500/5 to-transparent p-6 sm:p-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-blue-300">Campaign destinations</p><h2 className="mt-2 text-2xl font-semibold text-white">{props.companies?.length || 0} companies, {props.companies?.length || 0} original conversations.</h2></div><Button size="sm" variant="secondary" disabled={Boolean(pending)} onClick={() => moveTo('post_purchase_companies', true)} icon={pending === 'move-post_purchase_companies' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}>{pending === 'move-post_purchase_companies' ? 'Opening targets...' : 'Edit targets'}</Button></div></div><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">{props.companies?.map((company, index) => <div key={`${company.name}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><CompanyLogo company={company.domain || company.name} maxSize={11} minSize={11} /><div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{company.name}</p><p className="mt-1 truncate text-xs text-gray-500">{company.domain || 'Company research prepared after launch'}</p></div><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" /></div>)}</div></Card>
    <div className="grid gap-4 md:grid-cols-3"><button disabled={Boolean(pending)} aria-busy={pending === 'move-post_purchase_profile'} className="text-left disabled:cursor-wait disabled:opacity-70" onClick={() => moveTo('post_purchase_profile', true)}><Card hover className="h-full p-6"><div className="flex items-center justify-between"><UserRound className="h-5 w-5 text-emerald-300" />{pending === 'move-post_purchase_profile' ? <Loader2 className="h-4 w-4 animate-spin text-violet-300" /> : <Pencil className="h-4 w-4 text-gray-600" />}</div><p className="mt-4 font-semibold text-white">{props.profile?.name || 'Candidate profile'}</p><p className="mt-1 text-sm text-gray-400">{pending === 'move-post_purchase_profile' ? 'Opening profile...' : props.profile?.title || 'Your campaign evidence'}</p></Card></button><button disabled={Boolean(pending)} aria-busy={pending === `move-${plan === 'pro' || plan === 'ultra' ? 'post_purchase_filters' : 'post_purchase_companies'}`} className="text-left disabled:cursor-wait disabled:opacity-70" onClick={() => moveTo(plan === 'pro' || plan === 'ultra' ? 'post_purchase_filters' : 'post_purchase_companies', true)}><Card hover className="h-full p-6"><div className="flex items-center justify-between"><SlidersHorizontal className="h-5 w-5 text-violet-300" />{pending === `move-${plan === 'pro' || plan === 'ultra' ? 'post_purchase_filters' : 'post_purchase_companies'}` ? <Loader2 className="h-4 w-4 animate-spin text-violet-300" /> : <Pencil className="h-4 w-4 text-gray-600" />}</div><p className="mt-4 text-2xl font-bold text-white">{props.queries?.length || 'Default'}</p><p className="mt-1 text-sm text-gray-400">{pending === `move-${plan === 'pro' || plan === 'ultra' ? 'post_purchase_filters' : 'post_purchase_companies'}` ? 'Opening strategy...' : 'recruiter strategies configured'}</p></Card></button><button disabled={Boolean(pending)} aria-busy={pending === 'move-post_purchase_instructions'} className="text-left disabled:cursor-wait disabled:opacity-70" onClick={() => moveTo('post_purchase_instructions', true)}><Card hover className="h-full p-6"><div className="flex items-center justify-between"><Zap className="h-5 w-5 text-amber-300" />{pending === 'move-post_purchase_instructions' ? <Loader2 className="h-4 w-4 animate-spin text-violet-300" /> : <Pencil className="h-4 w-4 text-gray-600" />}</div><p className="mt-4 line-clamp-2 font-semibold text-white">{props.customizations?.position_description}</p><p className="mt-1 text-sm text-gray-400">{pending === 'move-post_purchase_instructions' ? 'Opening direction...' : 'campaign direction'}</p></Card></button></div>
    <Card hover={false} className="border-emerald-400/20 p-6 text-center sm:p-8"><h2 className="text-2xl font-semibold text-white">Everything is saved. Ready when you are.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-400">The definitive pipeline will research every company, select every recruiter from scratch, and write each email from this campaign brief.</p><Button size="lg" className="mt-6" disabled={Boolean(pending)} onClick={() => { track({ name: 'campaign_launch_clicked', params: { plan, company_count: props.companies?.length || 0 } }); void run('launch', launchPostPurchaseCampaign) }} icon={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}>{pending ? 'Launching...' : 'Launch my campaign'}</Button>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}</Card>
  </ActivationChapter>
}

export function OnboardingExperience(props: Props) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [replayPhase, setReplayPhase] = useState<'idle' | 'search' | 'email' | 'reveal'>(() => props.stage === 'preview_ready' ? 'reveal' : 'idle')
  const [optimisticPostStage, setOptimisticPostStage] = useState<OnboardingStage | null>(null)
  const [optimisticReturnToReview, setOptimisticReturnToReview] = useState(false)
  const shouldPollPreview = useCallback((current: OnboardingPreviewState) => (
    ['profile_generating', 'recruiter_search', 'recruiter_found', 'email_generation'].includes(props.stage)
      || (props.stage === 'target_company' && ['queued', 'running'].includes(current.profileStatus || ''))
  ), [props.stage])
  const preview = usePreview(props.initialPreview, shouldPollPreview)
  // The preview document intentionally remains `preview_ready` so its original
  // result can be archived. During paid activation the user document is the
  // source of truth for the current setup stage.
  // preview.stage only wins for the stages the Python worker actually drives on
  // the preview doc (the recruiter/email pipeline); for everything else (e.g. the
  // profile flow), the user doc's onboardingStage (props.stage) is authoritative.
  const previewLiveStages: OnboardingStage[] = ['recruiter_search', 'recruiter_found', 'email_generation', 'preview_ready']
  const persistedStage = (
    postPurchaseStages.includes(props.stage)
      ? props.stage
      : (previewLiveStages.includes(preview.stage as OnboardingStage) ? preview.stage : props.stage)
  ) as OnboardingStage
  const effectiveStage = (optimisticPostStage || persistedStage) as OnboardingStage
  const stageEnteredAt = useRef(Date.now())
  useEffect(() => {
    const enteredAt = Date.now()
    stageEnteredAt.current = enteredAt
    if (effectiveStage === 'recruiter_search') {
      const existing = sessionStorage.getItem('candidai-search-started-at')
      if (!existing) sessionStorage.setItem('candidai-search-started-at', String(enteredAt))
      const engagedTimer = window.setTimeout(() => {
        track({ name: 'search_experience_engaged', params: { visible_time_ms: Date.now() - enteredAt } })
      }, 30_000)
      return () => {
        window.clearTimeout(engagedTimer)
        const visible = Date.now() - enteredAt
        track({ name: 'onboarding_scene_summary', params: { stage: effectiveStage, visible_time_ms: visible, left_page: document.visibilityState === 'hidden' } })
        if (document.visibilityState === 'hidden') track({ name: 'search_experience_left', params: { visible_time_ms: visible } })
      }
    }
    if (effectiveStage === 'preview_ready') {
      const started = Number(sessionStorage.getItem('candidai-search-started-at') || 0)
      if (started) {
        track({ name: 'search_result_revealed', params: { total_search_time_ms: Date.now() - started } })
        sessionStorage.removeItem('candidai-search-started-at')
      }
    }
    return () => track({ name: 'onboarding_scene_summary', params: { stage: effectiveStage, visible_time_ms: Date.now() - enteredAt, left_page: document.visibilityState === 'hidden' } })
  }, [effectiveStage])
  const previousStage = useRef<OnboardingStage>(effectiveStage)
  useEffect(() => { if (effectiveStage !== props.stage && ['target_company', 'recruiter_search'].includes(props.stage)) router.refresh() }, [effectiveStage, props.stage, router])
  useEffect(() => {
    if (effectiveStage === 'preview_ready' && previousStage.current !== 'preview_ready' && replayPhase === 'idle') setReplayPhase('reveal')
    previousStage.current = effectiveStage
  }, [effectiveStage, replayPhase])
  useEffect(() => {
    if (effectiveStage === 'preview_ready' && typeof window !== 'undefined' && localStorage.getItem('candidai-preview-notification') === '1' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Your first application is ready', { body: `Your email to ${preview.recruiter?.name || 'the selected recruiter'} is ready to review.` })
      localStorage.removeItem('candidai-preview-notification')
    }
  }, [effectiveStage, preview.recruiter?.name])
  const profileReviewAdvanceStarted = useRef(false)
  useEffect(() => {
    if (effectiveStage !== 'profile_generating' || preview.profileStatus !== 'completed') return
    if (profileReviewAdvanceStarted.current) return
    profileReviewAdvanceStarted.current = true
    void advanceToProfileReview().then(() => router.refresh())
  }, [effectiveStage, preview.profileStatus, router])
  const retryProfileGeneration = useCallback(() => {
    startTransition(async () => {
      await startOnboardingProfileGeneration({ stayOnGenerating: true })
      router.refresh()
    })
  }, [router])
  const stopReplay = useCallback(() => setReplayPhase('idle'), [])
  const showReplayEmail = useCallback(() => setReplayPhase('email'), [])
  useEffect(() => {
    if (replayPhase !== 'email') return
    const timer = window.setTimeout(() => setReplayPhase('reveal'), 9000)
    return () => window.clearTimeout(timer)
  }, [replayPhase])
  useEffect(() => {
    if (replayPhase !== 'reveal') return
    const timer = window.setTimeout(stopReplay, 6500)
    return () => window.clearTimeout(timer)
  }, [replayPhase, stopReplay])
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
  const displayedStage: OnboardingStage = replayPhase === 'search' ? 'recruiter_search' : replayPhase === 'email' ? 'email_generation' : effectiveStage
  const sceneKey = replayPhase === 'idle' ? effectiveStage : `replay-${replayPhase}`
  const isPostPurchase = postPurchaseStages.includes(effectiveStage)
  const stageSequence: OnboardingStage[] = ['profile_source', 'profile_review', 'target_company', 'recruiter_search', 'recruiter_found', 'email_generation', 'preview_ready', 'checkout', ...postPurchaseStages, 'completed']
  const previousSceneIndex = useRef(stageSequence.indexOf(effectiveStage))
  const currentSceneIndex = stageSequence.indexOf(effectiveStage)
  const transitionDirection = currentSceneIndex >= previousSceneIndex.current ? 1 : -1
  const navigatePostPurchase = useCallback(async (nextStage: OnboardingStage, returnToReview = false) => {
    const previousStage = optimisticPostStage
    const previousReturn = optimisticReturnToReview
    setOptimisticPostStage(nextStage)
    setOptimisticReturnToReview(returnToReview)
    try {
      await navigatePostPurchaseStage(nextStage, returnToReview)
      router.refresh()
    } catch (error) {
      setOptimisticPostStage(previousStage)
      setOptimisticReturnToReview(previousReturn)
      throw error
    }
  }, [optimisticPostStage, optimisticReturnToReview, router])
  useEffect(() => {
    if (optimisticPostStage && props.stage === optimisticPostStage) setOptimisticPostStage(null)
  }, [optimisticPostStage, props.stage])
  useEffect(() => { previousSceneIndex.current = currentSceneIndex }, [currentSceneIndex, sceneKey])
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [sceneKey])
  return <LayoutGroup id="onboarding-completion"><div>{!isPostPurchase && <JourneyHeader stage={displayedStage} />}
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={sceneKey} className="relative" initial={{ opacity: 0, x: reduceMotion ? 0 : 34 * transitionDirection, filter: reduceMotion ? 'none' : 'blur(8px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: reduceMotion ? 0 : -28 * transitionDirection, filter: reduceMotion ? 'none' : 'blur(8px)' }} transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}>
        {replayPhase === 'search' && <SearchExperience preview={replayPreview} replay onReplayComplete={showReplayEmail} />}
        {replayPhase === 'email' && <><Button variant="ghost" size="sm" className="absolute right-4 top-0 z-10 text-gray-500" onClick={stopReplay}>Back to result</Button><ApplicationAssembly preview={preview} /></>}
        {replayPhase === 'reveal' && <EmailDeliveryReveal preview={preview} />}
        {replayPhase === 'idle' && <>
          {isPostPurchase && <PostPurchaseExperience props={{ ...props, stage: effectiveStage, postPurchaseReturnToReview: optimisticPostStage ? optimisticReturnToReview : props.postPurchaseReturnToReview }} preview={preview} onNavigate={navigatePostPurchase} />}
          {(effectiveStage === 'profile_source' || effectiveStage === 'profile_review') && <ProfileAnalysisClient userId={props.user.uid} plan="free_trial" initialProfile={props.profile} initialCvUrl={props.cvUrl} flow="guided" />}
          {effectiveStage === 'target_company' && <div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><Badge className="mb-4 border-violet-400/20 bg-violet-400/10 text-violet-200">Choose one real opportunity</Badge><h2 className="text-3xl font-bold text-white sm:text-4xl">Which company would you like to join?</h2><p className="mx-auto mt-3 max-w-xl text-gray-400">One company is enough. Your profile will guide who we look for and how we approach them.</p></div>
            <CompanyInputClient userId={props.user.uid} maxCompanies={1} initialCompanies={props.companies} mode="single-preview" /></div>}
          {effectiveStage === 'profile_generating' && (
            preview.profileStatus === 'failed'
              ? <Card hover={false} className="mx-auto mt-6 max-w-xl p-6 text-center"><p className="font-semibold text-white">Building your profile was interrupted</p><p className="mt-2 text-sm text-gray-400">You can try again without losing your CV or LinkedIn details.</p><Button className="mt-5" onClick={retryProfileGeneration}>Try again</Button></Card>
              : <ProfileBuildingExperience preview={preview} />
          )}
          {effectiveStage === 'recruiter_search' && preview.status !== 'failed' && <SearchExperience preview={preview} />}
          {(effectiveStage === 'recruiter_found' || effectiveStage === 'email_generation') && preview.status !== 'failed' && <ApplicationAssembly preview={preview} />}
          {effectiveStage === 'preview_ready' && <ConversionResult preview={preview} email={props.user.email} />}
          {preview.status === 'failed' && <Card hover={false} className="mx-auto mt-6 max-w-xl p-6 text-center"><p className="font-semibold text-white">The research was interrupted</p><p className="mt-2 text-sm text-gray-400">You can try again without losing your profile or company.</p><Button className="mt-5" onClick={() => startOnboardingRecruiterSearch().then(() => router.refresh())}>Try again</Button></Card>}
        </>}
      </motion.div>
    </AnimatePresence>
  </div></LayoutGroup>
}
