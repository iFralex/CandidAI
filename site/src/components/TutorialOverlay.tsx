'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTutorial } from './TutorialContext';

const PADDING = 10;
const TOOLTIP_WIDTH = 320;

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function computeTooltipPosition(rect: TargetRect | null): React.CSSProperties {
    if (!rect) {
        return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const wW = window.innerWidth;
    const wH = window.innerHeight;
    const tooltipH = 200;

    let top = rect.top + rect.height + PADDING + 8;
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;

    if (top + tooltipH > wH - 20) {
        top = rect.top - tooltipH - PADDING - 8;
    }
    top = Math.max(12, top);
    left = Math.max(12, Math.min(left, wW - TOOLTIP_WIDTH - 12));

    return { position: 'fixed', top, left };
}

export function TutorialOverlay() {
    const { isActive, currentStep, totalSteps, activeSteps, nextStep, prevStep, skip } = useTutorial();
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const [mounted, setMounted] = useState(false);
    const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentStepData = activeSteps[currentStep];

    const updateRect = useCallback(() => {
        if (!currentStepData?.targetId) {
            setTargetRect(null);
            return;
        }
        const el = document.querySelector(`[data-tutorial="${currentStepData.targetId}"]`) as HTMLElement | null;
        if (!el) {
            setTargetRect(null);
            return;
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
            const r = el.getBoundingClientRect();
            setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }, 350);
    }, [currentStepData]);

    useEffect(() => {
        if (!isActive) {
            setTargetRect(null);
            return;
        }
        updateRect();
    }, [isActive, currentStep, updateRect]);

    useEffect(() => {
        if (!isActive) return;
        const onResize = () => updateRect();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [isActive, updateRect]);

    useEffect(() => {
        return () => {
            if (scrollTimer.current) clearTimeout(scrollTimer.current);
        };
    }, []);

    if (!mounted || !isActive || !currentStepData) return null;

    const holeTop = targetRect ? targetRect.top - PADDING : 0;
    const holeLeft = targetRect ? targetRect.left - PADDING : 0;
    const holeW = targetRect ? targetRect.width + PADDING * 2 : 0;
    const holeH = targetRect ? targetRect.height + PADDING * 2 : 0;

    const tooltipStyle = computeTooltipPosition(targetRect);

    const svgOverlay = (
        <svg
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9990, pointerEvents: 'none' }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <mask id="tutorial-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {targetRect && (
                        <rect x={holeLeft} y={holeTop} width={holeW} height={holeH} rx={10} fill="black" />
                    )}
                </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#tutorial-mask)" />
        </svg>
    );

    const highlightRing = targetRect && (
        <div
            style={{
                position: 'fixed',
                top: holeTop,
                left: holeLeft,
                width: holeW,
                height: holeH,
                borderRadius: 10,
                border: '2px solid rgba(139,92,246,0.8)',
                boxShadow: '0 0 0 3px rgba(139,92,246,0.18), 0 0 24px rgba(139,92,246,0.25)',
                zIndex: 9991,
                pointerEvents: 'none',
            }}
        />
    );

    const tooltip = (
        <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            style={{
                ...tooltipStyle,
                zIndex: 9999,
                width: TOOLTIP_WIDTH,
                background: 'linear-gradient(135deg, rgba(18,10,40,0.98) 0%, rgba(12,8,30,0.98) 100%)',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: 16,
                padding: '20px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.12)',
                color: 'white',
                pointerEvents: 'auto',
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width: i === currentStep ? 18 : 6,
                                height: 6,
                                borderRadius: 3,
                                background: i === currentStep ? 'rgb(139,92,246)' : 'rgba(255,255,255,0.18)',
                                transition: 'all 0.25s',
                            }}
                        />
                    ))}
                </div>
                <button
                    onClick={skip}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        lineHeight: 1,
                    }}
                    aria-label="Skip tutorial"
                >
                    <X size={15} />
                </button>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 7, color: 'white', margin: '0 0 7px' }}>
                {currentStepData.title}
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: '0 0 18px' }}>
                {currentStepData.description}
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
                {currentStep > 0 && (
                    <button
                        onClick={prevStep}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.8)',
                            borderRadius: 9,
                            padding: '8px 13px',
                            cursor: 'pointer',
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                        }}
                    >
                        <ChevronLeft size={13} /> Back
                    </button>
                )}
                <button
                    onClick={nextStep}
                    style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, rgb(139,92,246) 0%, rgb(109,62,216) 100%)',
                        border: 'none',
                        color: 'white',
                        borderRadius: 9,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                    }}
                >
                    {currentStep === totalSteps - 1 ? 'Done!' : (<>Next <ChevronRight size={13} /></>)}
                </button>
            </div>
        </motion.div>
    );

    return createPortal(
        <AnimatePresence>
            {svgOverlay}
            {highlightRing}
            {tooltip}
        </AnimatePresence>,
        document.body
    );
}
