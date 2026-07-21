'use client'

import type { ComponentType, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export type ProgressPhaseDetail = { label: string; icon?: ComponentType<{ className?: string }> }

/**
 * Reusable animated shell for onboarding "waiting" scenes: an optional
 * entrance-animated header slot, and an AnimatePresence phase card (with a
 * pulsing "live" ping dot and optional detail chips) that transitions
 * whenever `phase` changes.
 *
 * This is the shell extracted from `SearchExperience`'s recruiter-search
 * waiting scene, generalised so other onboarding waiting scenes (e.g.
 * profile generation) can reuse the exact same animation without a company
 * logo.
 */
export function ProgressScene({ eyebrow, title, subtitle, phase, phaseDetails, headerSlot }: {
  eyebrow?: string
  title: string
  subtitle?: string
  phase: string
  phaseDetails?: ProgressPhaseDetail[]
  headerSlot?: ReactNode
}) {
  return (
    <>
      {headerSlot && (
        <motion.div
          className="relative z-10 mx-auto flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-xl backdrop-blur-xl sm:absolute sm:left-1/2 sm:top-0 sm:-translate-x-1/2"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          {headerSlot}
        </motion.div>
      )}
      <div className="relative mx-1 mt-4 sm:absolute sm:inset-x-12 sm:bottom-5 sm:mx-0 sm:mt-0">
        {eyebrow && <p className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-gray-600">{eyebrow}</p>}
        <AnimatePresence mode="wait">
          <motion.div key={phase || 'initial'} initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.98 }} transition={{ duration: 0.55 }} className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/55 px-5 py-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-4"><span className="relative mt-1 flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-violet-500" /></span><div className="min-w-0 flex-1"><p className="font-medium text-white">{title}</p>{subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}{phaseDetails && phaseDetails.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{phaseDetails.map(detail => { const Icon = detail.icon || Sparkles; return <div key={detail.label} className="flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-400/[0.07] px-3 py-2 text-xs text-gray-200"><Icon className="h-3.5 w-3.5 text-violet-400" />{detail.label}</div> })}</div>}</div></div></motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
