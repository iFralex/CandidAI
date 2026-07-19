"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

/** Index of the item whose center is closest to `viewportCenter`. */
export function closestIndexToCenter(itemCenters: number[], viewportCenter: number): number {
    let closest = 0;
    let smallestDistance = Infinity;
    itemCenters.forEach((center, index) => {
        const distance = Math.abs(center - viewportCenter);
        if (distance < smallestDistance) {
            smallestDistance = distance;
            closest = index;
        }
    });
    return closest;
}

/** Visual scale for a card `offsetFromActive` positions away from the focused card. */
export function scaleForOffset(offsetFromActive: number): number {
    const distance = Math.abs(offsetFromActive);
    if (distance === 0) return 1;
    if (distance === 1) return 0.92;
    return 0.85;
}

/** Visual opacity for a card `offsetFromActive` positions away from the focused card. */
export function opacityForOffset(offsetFromActive: number): number {
    const distance = Math.abs(offsetFromActive);
    if (distance === 0) return 1;
    if (distance === 1) return 0.6;
    return 0.35;
}

/**
 * Maps a wheel event's deltas onto a horizontal scroll position. Prefers the
 * user's native horizontal intent (trackpad shift-scroll / trackpad swipe)
 * and otherwise converts vertical wheel delta into horizontal movement.
 */
export function wheelDeltaToScrollLeft(currentScrollLeft: number, deltaY: number, deltaX: number): number {
    if (Math.abs(deltaX) > Math.abs(deltaY)) return currentScrollLeft + deltaX;
    return currentScrollLeft + deltaY;
}

interface HorizontalScrollGalleryProps<T> {
    items: T[];
    /**
     * `offsetFromActive` is `index - activeIndex`: 0 for the focused card,
     * ALWAYS the real value (tracked continuously, independent of reduced
     * motion). `prefersReducedMotion` is passed alongside it so the caller
     * can neutralize its own visual falloff (e.g. treat every card as if its
     * offset were 0 for scale/opacity) without that also freezing which card
     * is really active for `aria-current`.
     */
    renderItem: (item: T, index: number, offsetFromActive: number, prefersReducedMotion: boolean) => ReactNode;
    className?: string;
    /** Applied as data-testid on the scroll container, for e2e assertions. */
    testId?: string;
    /** Accessible name for the scroll region (e.g. "Email examples"). */
    ariaLabel: string;
}

/**
 * Native `overflow-x: auto` + scroll-snap gallery: touch swipe works out of
 * the box on mobile. Vertical wheel input is mapped to horizontal scrolling so
 * a mouse/trackpad user gets the same "swipe sideways" feel without hijacking
 * pinch-zoom or native horizontal trackpad gestures — and releases the wheel
 * event back to the page for normal vertical scroll once the gallery has
 * nothing further to scroll toward in that direction. Keyboard users can
 * focus the region and press ArrowLeft/ArrowRight to move the scroll position
 * card-by-card (this moves scroll, not DOM focus — see `handleKeyDown`).
 */
export function HorizontalScrollGallery<T,>({ items, renderItem, className, testId, ariaLabel }: HorizontalScrollGalleryProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    // `useReducedMotion()` returns `boolean | null` (null before the media
    // query resolves on first render) — normalized to a real boolean here
    // since `renderItem`'s signature declares `prefersReducedMotion: boolean`.
    const prefersReducedMotion = useReducedMotion() ?? false;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // This tracking effect is NOT gated on `prefersReducedMotion`: which
        // card is active isn't itself an animation, it's the actual scroll
        // state — keyboard ArrowRight/ArrowLeft (and `aria-current`) depend on
        // `activeIndex` staying accurate. Only the *visual* falloff between
        // cards is what reduced motion should neutralize, in `renderItem`
        // below. (An earlier draft gated this whole effect on reduced motion,
        // which froze `activeIndex` at 0 forever and made repeated
        // ArrowRight presses unable to advance past the second card.)
        //
        // rAF-throttled: `scroll` can fire far more often than once per frame,
        // and a resize (viewport rotation, font swap) changes every item's
        // offset without emitting a `scroll` event at all — both are handled
        // by routing into the same `scheduleUpdate`.
        let frame: number | null = null;
        const updateActiveIndex = () => {
            frame = null;
            const viewportCenter = container.scrollLeft + container.clientWidth / 2;
            const centers = itemRefs.current.map((el) => (el ? el.offsetLeft + el.offsetWidth / 2 : 0));
            setActiveIndex(closestIndexToCenter(centers, viewportCenter));
        };
        const scheduleUpdate = () => {
            if (frame !== null) return;
            frame = requestAnimationFrame(updateActiveIndex);
        };

        scheduleUpdate();
        container.addEventListener("scroll", scheduleUpdate, { passive: true });

        const resizeObserver = new ResizeObserver(scheduleUpdate);
        resizeObserver.observe(container);
        for (const el of itemRefs.current) {
            if (el) resizeObserver.observe(el);
        }

        return () => {
            container.removeEventListener("scroll", scheduleUpdate);
            resizeObserver.disconnect();
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [items.length]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // No device-capability gate here (no `ontouchstart`/`maxTouchPoints`
        // check): a `wheel` event is only ever dispatched by a mouse wheel or
        // trackpad gesture, never by touch panning, in every modern browser.
        // Gating on "is this a touch-capable device" would incorrectly skip
        // wheel handling on hybrid laptops (touchscreen + mouse/trackpad),
        // even though the person is using the mouse right now.
        const handleWheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

            const target = wheelDeltaToScrollLeft(container.scrollLeft, event.deltaY, event.deltaX);
            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            const movingRight = target > container.scrollLeft;
            const canMoveRight = container.scrollLeft < maxScrollLeft - 1;
            const canMoveLeft = container.scrollLeft > 0;

            // At either edge, in the direction that has nothing left to
            // scroll toward: don't intercept — let the vertical wheel event
            // fall through to the page so scrolling isn't trapped here.
            if ((movingRight && !canMoveRight) || (!movingRight && !canMoveLeft)) return;

            event.preventDefault();
            container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, target));
        };
        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        const targetIndex = event.key === "ArrowRight"
            ? Math.min(activeIndex + 1, items.length - 1)
            : Math.max(activeIndex - 1, 0);
        itemRefs.current[targetIndex]?.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            inline: "center",
            block: "nearest",
        });
    };

    return (
        <div
            ref={containerRef}
            data-testid={testId}
            role="region"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={`flex snap-x snap-mandatory overflow-x-auto scroll-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${className ?? ""}`}
        >
            {items.map((item, index) => (
                <div
                    key={index}
                    ref={(el) => { itemRefs.current[index] = el; }}
                    className="snap-center shrink-0"
                >
                    {/* offsetFromActive is always real (see the tracking effect above);
                        prefersReducedMotion is passed through so the caller can decide
                        what to neutralize visually without losing the real active index. */}
                    {renderItem(item, index, index - activeIndex, prefersReducedMotion)}
                </div>
            ))}
        </div>
    );
}
