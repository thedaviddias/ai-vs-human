"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Controls fallback sizing: "section" for large areas, "widget" for small components */
  level?: "section" | "widget";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable error boundary for wrapping individual widgets/sections.
 *
 * React error boundaries must be class components — there is no hooks
 * equivalent for `getDerivedStateFromError` or `componentDidCatch`.
 *
 * Usage:
 *   <ErrorBoundary level="widget">
 *     <ContributionHeatmap data={data} />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("[ErrorBoundary]", error, { componentStack: errorInfo.componentStack });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isSection = this.props.level === "section";

      return (
        <div
          className={`flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 text-center ${
            isSection ? "py-16 px-8" : "py-8 px-6"
          }`}
        >
          <p className={`font-medium text-neutral-400 ${isSection ? "text-base" : "text-sm"}`}>
            Something went wrong
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <p className="mt-2 max-w-md text-xs text-red-400/70 font-mono break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
