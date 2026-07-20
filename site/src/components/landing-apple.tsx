"use client";

import { useState } from "react";
import { motion, useTransform, useMotionValueEvent, useReducedMotion, type MotionValue } from "framer-motion";
import { Syne } from "next/font/google";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";
import { emailExamples } from "@/lib/email-examples";
import { ScrollPinSection, fadeRange } from "@/components/scroll/ScrollPinSection";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { HeroVideo } from "@/components/HeroVideo";
import { HorizontalScrollGallery, scaleForOffset, opacityForOffset } from "@/components/scroll/HorizontalScrollGallery";
import type { EmailExample } from "@/lib/email-examples";

// One weight, one subset — this is the only place in the "apple" variant that
// needs a genuinely distinctive display face rather than the site's default
// Geist Sans. (Elsewhere on the site, `fontFamily: "'Syne', sans-serif"` is
// declared inline without ever loading Syne, so it silently falls back to the
// system sans — that's a pre-existing, unrelated issue; here it's loaded for real.)
const syne = Syne({ subsets: ["latin"], weight: ["800"], display: "swap" });

/**
 * How many characters of a `totalLength`-long string should be revealed at a
 * given scroll `progress` (0..1), ramping linearly between `revealStart` and
 * `revealEnd`. Used to type out the hero's example email in sync with scroll.
 */
export function charactersToReveal(progress: number, totalLength: number, revealStart: number, revealEnd: number): number {
    if (progress <= revealStart) return 0;
    if (progress >= revealEnd) return totalLength;
    const localProgress = (progress - revealStart) / (revealEnd - revealStart);
    return Math.round(localProgress * totalLength);
}

const heroEmail = emailExamples[0];

export function AppleHero() {
    return (
        <ScrollPinSection heightVh={250} className="bg-[#080510]" testId="apple-hero">
            {(progress) => <AppleHeroScenes progress={progress} />}
        </ScrollPinSection>
    );
}

function AppleHeroScenes({ progress }: { progress: MotionValue<number> }) {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) return <AppleHeroStatic />;
    return <AppleHeroAnimated progress={progress} />;
}

/** Trust badge + CTA button — identical markup in both the static and animated hero. */
function HeroCta() {
    return (
        <>
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#F2C572]">
                <Check className="h-3.5 w-3.5" /> Ready to review
            </span>
            <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300">One free test email</Badge>
            <Link href="/register">
                <Button
                    size="lg"
                    icon={<ArrowRight className="h-4 w-4" />}
                    onClick={() => track({ name: "landing_cta_click", params: { button_label: "Start Free Test", section: "apple_hero" } })}
                >
                    Start Free Test
                </Button>
            </Link>
        </>
    );
}

/**
 * Reduced-motion layout: a genuinely separate, normal-flow JSX tree —
 * headline, then the full email (no character reveal), then the CTA, stacked
 * in a column with `min-h-dvh` (natural height, no `overflow-hidden`). This is
 * NOT the animated scene's markup with static opacity values: that markup
 * centers the headline (in-flow, flex-centered) and the email block
 * (`absolute` + `top-1/2`) at the exact same point on screen — forcing both
 * to opacity 1 simultaneously would make them overlap directly.
 */
function AppleHeroStatic() {
    return (
        <div className="relative flex min-h-dvh w-full flex-col items-center justify-center gap-10 px-6 py-20 text-center">
            <AnimatedBackground />
            <h1 className={`${syne.className} font-black leading-[0.9] tracking-tight text-[clamp(4rem,10vw,9rem)]`}>
                <span className="block text-[#F5F3FF]">Land Your</span>
                <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                    Dream Job
                </span>
            </h1>
            {/* Says plainly what the product does, since "Land Your Dream Job"
                alone doesn't explain it — no scroll-hint or early CTA needed
                here (unlike the animated version below): everything, CTA
                included, is already visible at once in this static layout. */}
            <p className="max-w-xl text-lg text-gray-400">
                AI-powered recruiter outreach, personalized for every company and role.
            </p>
            <div className="max-w-2xl text-left">
                <div className="mb-3 flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-[0.2em] text-violet-300">
                    <span>To: {heroEmail.recruiter}</span>
                    <span>Subject: {heroEmail.subject}</span>
                </div>
                <p className="whitespace-pre-line text-lg leading-relaxed text-gray-300">
                    {heroEmail.preview}
                </p>
            </div>
            <div className="flex flex-col items-center gap-3">
                <HeroCta />
            </div>
        </div>
    );
}

function AppleHeroAnimated({ progress }: { progress: MotionValue<number> }) {
    const headlineOpacity = useTransform(progress, (p) => 1 - fadeRange(p, 0, 0.28));
    const headlineScale = useTransform(progress, (p) => 1 - fadeRange(p, 0, 0.28) * 0.35);
    const emailOpacity = useTransform(progress, (p) => fadeRange(p, 0.22, 0.4));
    const ctaOpacity = useTransform(progress, (p) => fadeRange(p, 0.78, 1));
    // Visible from the very top of the page, so someone who never scrolls
    // through the full ~250vh sequence still has a way to convert. Fades out
    // just before the cinematic CTA fades in (0.78), so the two never overlap.
    const earlyCtaOpacity = useTransform(progress, (p) => 1 - fadeRange(p, 0.6, 0.75));

    // `opacity: 0` alone still leaves an element focusable, screen-reader
    // announced, and clickable — it's a visual-only fade. These derive a
    // discrete on/off from the same progress so both interactive CTAs are
    // truly removed from the tab order and hit-testing while faded out,
    // not just invisible.
    const earlyCtaInteractive = useTransform(progress, (p) =>
        fadeRange(p, 0.6, 0.75) < 1 ? ("auto" as const) : ("none" as const)
    );
    const earlyCtaVisibility = useTransform(progress, (p) =>
        fadeRange(p, 0.6, 0.75) < 1 ? ("visible" as const) : ("hidden" as const)
    );
    const ctaInteractive = useTransform(progress, (p) =>
        fadeRange(p, 0.78, 1) > 0 ? ("auto" as const) : ("none" as const)
    );
    const ctaVisibility = useTransform(progress, (p) =>
        fadeRange(p, 0.78, 1) > 0 ? ("visible" as const) : ("hidden" as const)
    );

    const [revealCount, setRevealCount] = useState(0);
    useMotionValueEvent(progress, "change", (p) => {
        const next = charactersToReveal(p, heroEmail.preview.length, 0.3, 0.75);
        // Only trigger a re-render when the revealed character count actually
        // changes — `progress` ticks far more often (every scroll-linked
        // frame) than the rounded character count does, especially outside
        // the 0.3-0.75 reveal window where `next` stays pinned at 0 or the
        // full length.
        setRevealCount((current) => (current === next ? current : next));
    });

    return (
        <div className="relative flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <AnimatedBackground />
            <motion.h1
                style={{ opacity: headlineOpacity, scale: headlineScale }}
                className={`${syne.className} font-black leading-[0.9] tracking-tight text-[clamp(4rem,10vw,9rem)]`}
            >
                <span className="block text-[#F5F3FF]">Land Your</span>
                <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                    Dream Job
                </span>
            </motion.h1>

            {/* Says plainly what the product does — "Land Your Dream Job" alone
                is evocative but doesn't explain the mechanism. Shares the
                headline's own opacity MotionValue: same fade-in/out rhythm,
                no separate useTransform needed. */}
            <motion.p style={{ opacity: headlineOpacity }} className="mt-4 max-w-xl px-6 text-lg text-gray-400">
                AI-powered recruiter outreach, personalized for every company and role.
            </motion.p>
            <motion.div
                style={{ opacity: headlineOpacity }}
                className="mt-8 flex flex-col items-center gap-2 text-xs uppercase tracking-[0.15em] text-gray-500"
            >
                <span>Scroll to see your email take shape</span>
                <ChevronDown className="h-4 w-4 animate-bounce" />
            </motion.div>

            {/* Quiet, non-dominant early exit for anyone who won't scroll
                through the whole ~250vh sequence — deliberately NOT styled
                like the gold "Ready to review" moment below, so it doesn't
                compete with or preempt that payoff. */}
            <motion.div
                data-testid="apple-hero-early-cta"
                style={{ opacity: earlyCtaOpacity, visibility: earlyCtaVisibility, pointerEvents: earlyCtaInteractive }}
                className="absolute bottom-10"
            >
                <Link
                    href="/register"
                    className="text-sm text-gray-400 underline-offset-4 transition-colors hover:text-white hover:underline"
                    onClick={() => track({ name: "landing_cta_click", params: { button_label: "Try one email free", section: "apple_hero_early" } })}
                >
                    Try one email free →
                </Link>
            </motion.div>

            {/* Explicit centered anchor (top-1/2 + both translates) instead of a
                bare `absolute` with no offsets — an absolutely positioned box
                with no top/left/right/bottom falls back to an undefined
                "static position" and can end up overlapping the headline. This
                scene only ever renders when NOT reduced-motion, and the
                headline/email opacity ranges only briefly overlap (0.22-0.28)
                as a deliberate crossfade — never both at full opacity. */}
            <motion.div
                style={{ opacity: emailOpacity }}
                className="absolute left-1/2 top-[44%] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-6 text-left sm:top-1/2"
            >
                <div className="mb-3 flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-[0.2em] text-violet-300">
                    <span>To: {heroEmail.recruiter}</span>
                    <span>Subject: {heroEmail.subject}</span>
                </div>
                {/* The visible, scroll-scrubbed reveal is aria-hidden; a
                    visually hidden `sr-only` element carries the FULL email
                    text at all times, so a screen reader user gets the
                    complete message immediately instead of a fragment tied to
                    scroll position. Smaller on narrow screens (`text-base` vs
                    `text-lg`) and anchored slightly higher (`top-[44%]`) than
                    on desktop, so the full multi-line preview has less chance
                    of growing tall enough to reach the final CTA at `bottom-16`
                    on short mobile viewports. */}
                <p aria-hidden="true" className="whitespace-pre-line text-base leading-relaxed text-gray-300 sm:text-lg">
                    {heroEmail.preview.slice(0, revealCount)}
                </p>
                <p className="sr-only">{heroEmail.preview}</p>
            </motion.div>

            {/* Gold accent reserved for this one completion moment — it never
                appears elsewhere on the page, so it reads as a real signal.
                data-testid lets the e2e suite (Task 10) assert this block's
                real opacity before/after scrolling through the sequence. */}
            <motion.div
                data-testid="apple-hero-cta"
                style={{ opacity: ctaOpacity, visibility: ctaVisibility, pointerEvents: ctaInteractive }}
                className="absolute bottom-16 flex flex-col items-center gap-3"
            >
                <HeroCta />
            </motion.div>
        </div>
    );
}

export function AppleCampaignVideo() {
    return (
        <ScrollPinSection heightVh={200} className="bg-black">
            {(progress) => <AppleCampaignVideoScene progress={progress} />}
        </ScrollPinSection>
    );
}

function AppleCampaignVideoScene({ progress }: { progress: MotionValue<number> }) {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) return <AppleCampaignVideoStatic />;
    return <AppleCampaignVideoAnimated progress={progress} />;
}

/**
 * Reduced motion: a normal, responsive, contained video card — not a frame
 * forced into a full-bleed edge-to-edge shape. There's no scroll-driven
 * expansion to justify full-bleed here, so `HeroVideo` renders with its
 * default props (capped width, rounded corners, border) exactly as it does
 * everywhere else on the site.
 */
function AppleCampaignVideoStatic() {
    return (
        <div className="flex w-full flex-col items-center justify-center gap-8 px-6 py-20">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
                Your next opportunity starts with being seen
            </p>
            <HeroVideo />
        </div>
    );
}

function AppleCampaignVideoAnimated({ progress }: { progress: MotionValue<number> }) {
    // Width ramps from a contained card up to 100% of this section's full-bleed
    // wrapper (the section itself has no horizontal padding — see below — so
    // 100% here really does reach the viewport edges, unlike the old approach
    // of animating a wrapper around a HeroVideo that still capped at max-w-5xl
    // internally).
    const width = useTransform(progress, (p) => `${55 + fadeRange(p, 0, 0.6) * 45}%`);
    const radius = useTransform(progress, (p) => 24 - fadeRange(p, 0, 0.6) * 24);
    const captionOpacity = useTransform(progress, (p) => 1 - fadeRange(p, 0, 0.3));

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8">
            <motion.p
                style={{ opacity: captionOpacity }}
                className="px-6 text-center text-sm font-semibold uppercase tracking-[0.18em] text-violet-300"
            >
                Your next opportunity starts with being seen
            </motion.p>
            <motion.div style={{ width, borderRadius: radius }} className="overflow-hidden">
                {/* wrapperClassName="" removes HeroVideo's own max-w-5xl cap; bare
                    drops its internal rounded corners/border so THIS wrapper's
                    animated radius is the only one that applies. */}
                <HeroVideo wrapperClassName="" bare />
            </motion.div>
        </div>
    );
}

export function AppleEmailGallery() {
    return (
        <section className="bg-black px-6 py-24 lg:px-8">
            <div className="mx-auto mb-12 max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Personalized for the person, company and role
                </p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    See AI-generated emails in action
                </h2>
            </div>
            <HorizontalScrollGallery
                items={emailExamples}
                className="gap-6 px-[10vw] pb-6"
                testId="apple-email-gallery"
                ariaLabel="Email examples"
                renderItem={(example, index, offsetFromActive, prefersReducedMotion) => (
                    <EmailLetterCard
                        example={example}
                        offsetFromActive={offsetFromActive}
                        prefersReducedMotion={prefersReducedMotion}
                        key={example.company}
                    />
                )}
            />
            <p className="mx-auto mt-2 max-w-3xl px-[10vw] text-sm italic leading-relaxed text-gray-400">
                * Some names and personal details have been adjusted to protect privacy and ensure compliance.
            </p>
        </section>
    );
}

function EmailLetterCard({
    example,
    offsetFromActive,
    prefersReducedMotion,
}: {
    example: EmailExample;
    offsetFromActive: number;
    prefersReducedMotion: boolean;
}) {
    // `offsetFromActive` is always the real, tracked value (see
    // HorizontalScrollGallery) — `aria-current` below reflects reality even
    // under reduced motion. Only the visual falloff is neutralized here.
    const visualOffset = prefersReducedMotion ? 0 : offsetFromActive;
    const scale = scaleForOffset(visualOffset);
    const opacity = opacityForOffset(visualOffset);
    return (
        <div
            aria-current={offsetFromActive === 0 ? "true" : undefined}
            className="w-[85vw] max-w-[520px] transition-all duration-300"
            style={{ opacity, transform: `scale(${scale})` }}
        >
            {/* Decorative envelope flap: a fixed-height (h-10) strip with its
                own V-notch clip-path. Kept separate from the card body below
                so the notch depth never changes with (and can never clip into)
                the actual content — unlike clipping the whole variable-height
                card, which scales the notch with content length. */}
            <div
                aria-hidden="true"
                className="h-10 w-full rounded-t-2xl bg-[#1B1330]"
                style={{ clipPath: "polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)" }}
            />
            <div className="rounded-b-2xl border border-white/10 bg-[#1B1330] p-6 pt-2">
                <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-[0.15em] text-violet-300">
                        To: {example.recruiter}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[10px] font-bold text-black">
                        {example.matchScore}
                    </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{example.company}</h3>
                {/* Candidate + role/education: present in the list+detail
                    layout this replaces (EmailExamplesSection) and dropped by
                    mistake in an earlier draft of this card — they're what
                    makes the personalization concrete, not decorative. */}
                <p className="mt-1 text-sm text-white/80">{example.candidate}</p>
                <p className="text-xs text-gray-400">{example.role}</p>
                <p className="mt-2 font-mono text-xs uppercase tracking-wider text-gray-500">
                    Subject: {example.subject}
                </p>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                    {example.preview}
                </p>
            </div>
        </div>
    );
}
