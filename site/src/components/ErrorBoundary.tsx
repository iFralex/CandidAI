"use client";

/**
 * ErrorBoundary.tsx
 *
 * React class-based error boundary that:
 * 1. Catches render-time errors in the component tree
 * 2. Fires an app_error analytics event so render errors are visible in GA4
 * 3. Shows a clean fallback UI instead of crashing the whole page
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 *   // Custom fallback:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { track } from "@/lib/analytics";

interface Props {
    children: ReactNode;
    /** Custom UI to show on error. Defaults to a generic message. */
    fallback?: ReactNode;
    /** Callback fired when an error is caught, in addition to analytics. */
    onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Fire analytics event (safe — never throws)
        track({
            name: "app_error",
            params: {
                error_type: "react_render_error",
                error_message: `${error.message} | Component: ${info.componentStack?.split("\n")[1]?.trim() ?? "unknown"}`.slice(0, 200),
                page_path: typeof window !== "undefined" ? window.location.pathname : "unknown",
            },
        });

        // Fire optional caller callback
        this.props.onError?.(error, info);

        // Log to console in development
        if (process.env.NODE_ENV !== "production") {
            console.error("[ErrorBoundary]", error, info.componentStack);
        }
    }

    render(): ReactNode {
        if (!this.state.hasError) return this.props.children;

        return this.props.fallback ?? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg
                        className="w-6 h-6 text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                    </svg>
                </div>
                <div>
                    <p className="text-white font-semibold">Something went wrong</p>
                    <p className="text-gray-400 text-sm mt-1">
                        This section failed to load. Try refreshing the page.
                    </p>
                </div>
                <button
                    onClick={() => this.setState({ hasError: false, error: null })}
                    className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
                >
                    Try again
                </button>
            </div>
        );
    }
}
