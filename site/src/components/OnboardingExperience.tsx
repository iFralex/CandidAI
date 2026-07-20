'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Building2, Check, CheckCircle2, Clock3, Loader2, Mail, Search, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { ProfileAnalysisClient, CompanyInputClient } from '@/components/onboarding'
import { PlanSelector, type PlanInfo } from '@/components/PlanSelector'
import { UnifiedCheckout } from '@/components/UnifiedCheckout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { confirmRecruiterAndGenerateEmail, continueFreePreviewToDashboard, setOnboardingNotificationPreference, startOnboardingRecruiterSearch } from '@/actions/onboarding-actions'
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
  { key: 'profile', label: 'Profilo', icon: UserRound },
  { key: 'company', label: 'Azienda', icon: Building2 },
  { key: 'recruiter', label: 'Contatto', icon: Search },
  { key: 'email', label: 'Email', icon: Mail },
]

function JourneyHeader({ stage }: { stage: OnboardingStage }) {
  const active = stage === 'profile_source' || stage === 'profile_review' ? 0
    : stage === 'target_company' ? 1
    : stage === 'recruiter_search' || stage === 'recruiter_found' ? 2 : 3
  return (
    <div className="mx-auto mb-10 flex max-w-2xl items-center justify-between gap-2" aria-label="Avanzamento prima candidatura">
      {journey.map((item, index) => {
        const Icon = item.icon
        const done = index < active
        const current = index === active
        return (
          <div key={item.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${done ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : current ? 'border-violet-400 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/5 text-gray-600'}`}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-xs ${current ? 'text-white' : 'text-gray-500'}`}>{item.label}</span>
            </div>
            {index < journey.length - 1 && <div className={`mx-2 mb-6 h-px flex-1 ${index < active ? 'bg-emerald-400/40' : 'bg-white/10'}`} />}
          </div>
        )
      })}
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
  const company = preview.company?.name || 'l’azienda scelta'
  const queryCount = preview.searchContext?.queryCount || 30
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <Badge className="mb-4">Ricerca approfondita in corso</Badge>
        <h2 className="text-3xl font-bold text-white">Cerchiamo la persona giusta dentro {company}</h2>
        <p className="mt-3 text-gray-400">Confrontiamo fino a {queryCount} strategie, dalla più precisa alla più ampia. In media servono circa due minuti.</p>
      </div>
      <Card hover={false} className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-white"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /> Analisi del team recruiting</CardTitle>
          <CardDescription>{preview.searchProgress?.attempt ? `Strategia ${preview.searchProgress.attempt} analizzata: ${preview.searchProgress.strategy || 'ricerca progressiva'}.` : 'La ricerca si ferma appena trova un contatto verificabile e coerente con il tuo profilo.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pb-6">
          {preview.searchContext?.narrative && <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-100">{preview.searchContext.narrative}</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            {['Esperienza e competenze', 'Ruolo e seniority', 'Paese e affinità'].map((label) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300"><CheckCircle2 className="mb-2 h-4 w-4 text-violet-400" />{label}</div>)}
          </div>
          <Separator />
          <div className="flex items-start gap-3 text-sm text-gray-400"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /><p>Puoi attendere qui oppure lasciare la pagina: lo stato è già salvato e al ritorno ripartirai esattamente da questo punto.</p></div>
        </CardContent>
      </Card>
      <Card hover={false} className="border-violet-500/20 bg-violet-500/5 p-5">
        <div className="flex gap-3"><Bell className="h-5 w-5 shrink-0 text-violet-400" /><div className="flex-1"><p className="font-medium text-white">Non vuoi aspettare?</p><p className="mt-1 text-sm text-gray-400">Ti riportiamo direttamente alla conferma del recruiter appena la ricerca termina.</p><div className="mt-4 flex flex-wrap gap-3"><Button variant="secondary" size="sm" disabled={emailNotice} onClick={async () => { await setOnboardingNotificationPreference('email', true); setEmailNotice(true) }}>{emailNotice ? 'Email attivata' : 'Avvisami via email'}</Button><Button variant="secondary" size="sm" disabled={browserNotice} onClick={async () => { if (!('Notification' in window)) return; const permission = await Notification.requestPermission(); if (permission === 'granted') { localStorage.setItem('candidai-preview-notification', '1'); await setOnboardingNotificationPreference('browser', true); setBrowserNotice(true) } }}>{browserNotice ? 'Notifica attivata' : 'Notifica sul dispositivo'}</Button></div></div></div>
      </Card>
    </div>
  )
}

function RecruiterConfirmation({ preview, onConfirmed }: { preview: OnboardingPreviewState; onConfirmed: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">Contatto trovato</Badge><h2 className="text-3xl font-bold text-white">Abbiamo trovato chi contattare</h2></div>
      <Card hover={false} className="p-8 text-left">
        <div className="flex items-start justify-between gap-4"><div><p className="text-2xl font-semibold text-white">{preview.recruiter?.name}</p><p className="mt-1 text-violet-300">{preview.recruiter?.jobTitle}</p><p className="mt-1 text-sm text-gray-500">{preview.company?.name}</p></div><div className="rounded-2xl bg-emerald-400/10 p-3"><ShieldCheck className="h-6 w-6 text-emerald-400" /></div></div>
        <Separator className="my-6" />
        <p className="text-sm font-medium text-white">Perché questo contatto</p>
        <p className="mt-2 text-sm leading-6 text-gray-400">È il primo profilo trovato dalla strategia “{preview.matchedQuery?.name || 'migliore corrispondenza disponibile'}”, dopo aver confrontato ruolo, seniority, percorso e posizione geografica.</p>
      </Card>
      <Button disabled={pending || !preview.jobId} size="lg" onClick={() => startTransition(async () => { await confirmRecruiterAndGenerateEmail(preview.jobId!); onConfirmed() })} icon={pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}>{pending ? 'Prepariamo l’email…' : 'Scrivi la mia email'}</Button>
    </div>
  )
}

function ConversionResult({ preview, email }: { preview: OnboardingPreviewState; email?: string }) {
  const [selected, setSelected] = useState<PlanInfo | null>(null)
  const checkoutRef = useRef<HTMLDivElement>(null)
  const choose = useCallback((plan: PlanInfo) => { setSelected(plan); window.setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }, [])
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <div className="text-center"><Badge className="mb-4 bg-emerald-500/15 text-emerald-300">Prima candidatura completata</Badge><h2 className="text-4xl font-bold text-white">La tua prima candidatura è pronta</h2><p className="mt-3 text-gray-400">Hai trasformato il tuo profilo in un contatto mirato e un messaggio personale per {preview.company?.name}.</p></div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card hover={false} className="p-6"><p className="text-sm text-gray-500">Destinatario</p><p className="mt-2 text-lg font-semibold text-white">{preview.recruiter?.name}</p><p className="text-sm text-violet-300">{preview.recruiter?.jobTitle}</p><Separator className="my-5" /><div className="space-y-3 text-sm text-gray-400">{(preview.email?.keyPoints || []).map(point => <p key={point} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{point}</p>)}</div></Card>
        <Card hover={false} className="p-6"><p className="text-sm text-gray-500">Oggetto</p><p className="mt-1 font-semibold text-white">{preview.email?.subject}</p><Separator className="my-5" /><div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">{preview.email?.body}</div></Card>
      </div>
      <section className="space-y-6 text-center"><div><h3 className="text-3xl font-bold text-white">Ora moltiplica le opportunità</h3><p className="mx-auto mt-3 max-w-2xl text-gray-400">Sblocca altre aziende, ricerca automatica dei recruiter, personalizzazioni avanzate e l’intera campagna dalla dashboard.</p></div><PlanSelector selectedPlanId={selected?.id} onSelect={choose} onCtaClick={choose} ctaLabel="Continua con questo piano" /></section>
      {selected && <div ref={checkoutRef} className="scroll-mt-8"><Card hover={false} className="mx-auto max-w-3xl border-violet-500/30 p-6"><UnifiedCheckout purchaseType="plan" itemId={selected.id} email={email || ''} /></Card></div>}
      <div className="pt-4 text-center"><form action={continueFreePreviewToDashboard}><Button variant="ghost" type="submit" className="text-sm text-gray-500 hover:text-gray-300">Per ora, esplora la dashboard</Button></form></div>
    </div>
  )
}

export function OnboardingExperience(props: Props) {
  const router = useRouter()
  const poll = ['recruiter_search', 'recruiter_found', 'email_generation', 'preview_ready'].includes(props.stage)
  const preview = usePreview(props.initialPreview, poll)
  const effectiveStage = (preview.stage || props.stage) as OnboardingStage
  useEffect(() => {
    if (effectiveStage !== props.stage && ['target_company', 'recruiter_search'].includes(props.stage)) router.refresh()
  }, [effectiveStage, props.stage, router])
  useEffect(() => {
    if (effectiveStage === 'recruiter_found' && typeof window !== 'undefined' && localStorage.getItem('candidai-preview-notification') === '1' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Abbiamo trovato il contatto giusto', { body: `${preview.recruiter?.name || 'Il recruiter'} è pronto per la tua conferma.` })
      localStorage.removeItem('candidai-preview-notification')
    }
  }, [effectiveStage, preview.recruiter?.name])
  return <div><JourneyHeader stage={effectiveStage} />
    {(effectiveStage === 'profile_source' || effectiveStage === 'profile_review') && <ProfileAnalysisClient userId={props.user.uid} plan="free_trial" initialProfile={props.profile} initialCvUrl={props.cvUrl} flow="guided" />}
    {effectiveStage === 'target_company' && <div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><h2 className="text-3xl font-bold text-white">In quale azienda vorresti entrare?</h2><p className="mt-3 text-gray-400">Per la prima candidatura ne basta una. Cercheremo la persona più adatta a riceverla.</p></div><CompanyInputClient userId={props.user.uid} maxCompanies={1} initialCompanies={props.companies} mode="single-preview" /></div>}
    {effectiveStage === 'recruiter_search' && <SearchExperience preview={preview} />}
    {effectiveStage === 'recruiter_found' && <RecruiterConfirmation preview={preview} onConfirmed={() => router.refresh()} />}
    {effectiveStage === 'email_generation' && <div className="mx-auto max-w-2xl text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-400" /><h2 className="mt-6 text-3xl font-bold text-white">Stiamo scrivendo la tua email</h2><p className="mt-3 text-gray-400">Ora colleghiamo il tuo profilo, {preview.company?.name} e il contatto appena confermato in un messaggio personale.</p></div>}
    {effectiveStage === 'preview_ready' && <ConversionResult preview={preview} email={props.user.email} />}
    {preview.status === 'failed' && <Card hover={false} className="mx-auto mt-6 max-w-xl p-6 text-center"><p className="font-semibold text-white">La ricerca si è interrotta</p><p className="mt-2 text-sm text-gray-400">{preview.error?.message || 'Puoi riprovare senza perdere il profilo o l’azienda.'}</p><Button className="mt-5" onClick={() => startOnboardingRecruiterSearch().then(() => router.refresh())}>Riprova</Button></Card>}
  </div>
}
