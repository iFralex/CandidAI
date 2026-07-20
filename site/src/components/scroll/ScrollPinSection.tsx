"use client";

import { useRef, type ReactNode } from "react";
import { useScroll, useReducedMotion, type MotionValue } from "framer-motion";

/**
 * Linear 0..1 progress of `progress` between `start` and `end`, clamped.
 * An empty range (`start === end`) is a hard step at `start`.
 */
export function fadeRange(progress: number, start: number, end: number): number {
    if (start === end) return progress < start ? 0 : 1;
    const clamped = Math.min(Math.max(progress, start), end);
    return (clamped - start) / (end - start);
}

interface ScrollPinSectionProps {
    /** Total scrollable height of the wrapper, in viewport-height units. */
    heightVh?: number;
    className?: string;
    /** Render-prop receiving 0..1 scroll progress across the pinned section. */
    children: (progress: MotionValue<number>) => ReactNode;
    /** Applied as data-testid on the outer (tall) wrapper, for e2e assertions. */
    testId?: string;
}

/**
 * Tall wrapper (`heightVh` tall, in static `vh` — a stable reference for the
 * scroll-distance math) with a `sticky top-0 h-dvh` inner panel (`dvh` here,
 * so it matches the actually-visible viewport instant to instant, avoiding
 * jumps from Safari's mobile address bar). `children` receives a MotionValue
 * tracking scroll progress (0 at the top of the wrapper, 1 at its bottom) to
 * drive scroll-scrubbed animations.
 *
 * Under `prefers-reduced-motion`, the tall scroll-jacking/sticky/pinned
 * wrapper is skipped entirely: children render directly inside `className`
 * with NO forced height or `overflow-hidden`. This primitive does not know
 * what a sensible static layout looks like for its children's specific
 * content — that responsibility belongs to the caller. `AppleHero` and
 * `AppleCampaignVideo` (Tasks 6-7) each render a genuinely different,
 * normal-flow JSX tree under reduced motion — NOT the same absolutely
 * positioned "scene" markup with static opacity values, which would still
 * risk overlapping content (e.g. a centered headline and a centered email
 * block occupying the same point on screen).
 */
export function ScrollPinSection({ heightVh = 250, className, children, testId }: ScrollPinSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"],
    });

    if (prefersReducedMotion) {
        // `containerRef` must still be attached to a real DOM node even here:
        // `useScroll({ target: containerRef })` above throws ("Target ref is
        // defined but not hydrated") if the ref is provided but never mounts
        // to anything. The resulting scrollYProgress value is unused by
        // reduced-motion consumers, but the ref itself must be live.
        return <div ref={containerRef} className={className} data-testid={testId}>{children(scrollYProgress)}</div>;
    }

    return (
        <div ref={containerRef} data-testid={testId} style={{ height: `${heightVh}vh` }} className={className}>
            <div className="sticky top-0 h-dvh overflow-hidden">
                {children(scrollYProgress)}
            </div>
        </div>
    );
}
