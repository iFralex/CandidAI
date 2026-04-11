'use client';

import { useEffect, useRef } from 'react';
import { useTutorial, TutorialStep } from './TutorialContext';

interface TutorialTriggerProps {
    pageId: string;
    steps: TutorialStep[];
}

export function TutorialTrigger({ pageId, steps }: TutorialTriggerProps) {
    const { isPageCompleted, startTutorial, isActive } = useTutorial();
    const started = useRef(false);

    useEffect(() => {
        if (started.current || isActive) return;
        if (isPageCompleted(pageId)) return;
        // Small delay to let DOM settle
        const t = setTimeout(() => {
            started.current = true;
            startTutorial(pageId, steps);
        }, 600);
        return () => clearTimeout(t);
    }, [pageId, steps, isPageCompleted, startTutorial, isActive]);

    return null;
}
