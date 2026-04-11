'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const TUTORIAL_KEY = 'candidai_tutorial_v1';

export interface TutorialStep {
    targetId?: string;
    title: string;
    description: string;
}

interface TutorialState {
    completedPages: string[];
}

interface TutorialContextValue {
    isActive: boolean;
    currentStep: number;
    totalSteps: number;
    activeSteps: TutorialStep[];
    activePageId: string | null;
    startTutorial: (pageId: string, steps: TutorialStep[]) => void;
    nextStep: () => void;
    prevStep: () => void;
    skip: () => void;
    resetTutorials: () => void;
    isPageCompleted: (pageId: string) => boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<TutorialState>({ completedPages: [] });
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeSteps, setActiveSteps] = useState<TutorialStep[]>([]);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const pageIdRef = useRef<string | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(TUTORIAL_KEY);
            if (stored) setState(JSON.parse(stored));
        } catch {}
    }, []);

    const persist = useCallback((newState: TutorialState) => {
        setState(newState);
        try {
            localStorage.setItem(TUTORIAL_KEY, JSON.stringify(newState));
        } catch {}
    }, []);

    const isPageCompleted = useCallback(
        (pageId: string) => state.completedPages.includes(pageId),
        [state.completedPages]
    );

    const endTutorial = useCallback(
        (pid?: string | null) => {
            const resolvedId = pid ?? pageIdRef.current;
            setIsActive(false);
            setActivePageId(null);
            pageIdRef.current = null;
            if (resolvedId) {
                setState((prev) => {
                    const newState = {
                        completedPages: [...new Set([...prev.completedPages, resolvedId])],
                    };
                    try {
                        localStorage.setItem(TUTORIAL_KEY, JSON.stringify(newState));
                    } catch {}
                    return newState;
                });
            }
        },
        []
    );

    const startTutorial = useCallback((pageId: string, steps: TutorialStep[]) => {
        pageIdRef.current = pageId;
        setActivePageId(pageId);
        setActiveSteps(steps);
        setCurrentStep(0);
        setIsActive(true);
    }, []);

    const nextStep = useCallback(() => {
        setCurrentStep((prev) => {
            if (prev >= activeSteps.length - 1) {
                endTutorial(pageIdRef.current);
                return prev;
            }
            return prev + 1;
        });
    }, [activeSteps.length, endTutorial]);

    const prevStep = useCallback(() => {
        setCurrentStep((prev) => Math.max(0, prev - 1));
    }, []);

    const skip = useCallback(() => {
        endTutorial(pageIdRef.current);
    }, [endTutorial]);

    const resetTutorials = useCallback(() => {
        persist({ completedPages: [] });
    }, [persist]);

    return (
        <TutorialContext.Provider
            value={{
                isActive,
                currentStep,
                totalSteps: activeSteps.length,
                activeSteps,
                activePageId,
                startTutorial,
                nextStep,
                prevStep,
                skip,
                resetTutorials,
                isPageCompleted,
            }}
        >
            {children}
        </TutorialContext.Provider>
    );
}

export function useTutorial() {
    const ctx = useContext(TutorialContext);
    if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider');
    return ctx;
}
