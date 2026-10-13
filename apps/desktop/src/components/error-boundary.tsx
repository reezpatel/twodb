import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of children after a render error. */
  fallback: (props: ErrorBoundaryFallbackProps) => ReactNode;
  /** Changing any key clears the error (e.g. a new question id). */
  resetKeys?: unknown[];
  /** Label used in the console log to locate the failing subtree. */
  name?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors in a subtree so one bad payload can't blank the whole route. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (!this.state.error) return;
    const a = prev.resetKeys ?? [];
    const b = this.props.resetKeys ?? [];
    if (a.length !== b.length || a.some((k, i) => !Object.is(k, b[i]))) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback({ error: this.state.error, reset: this.reset });
    return this.props.children;
  }
}
