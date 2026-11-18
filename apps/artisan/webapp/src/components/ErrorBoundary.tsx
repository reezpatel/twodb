import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label so the fallback says *what* crashed. */
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * Render-error boundary: one bad widget (ask_user, a message bubble, …) must
 * not take the whole app down with a blank page. Shows the error inline with
 * a retry button that remounts the children.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-3 flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-destructive">
          <TriangleAlert className="size-4" />
          {this.props.name ? `${this.props.name} crashed` : "Something crashed"}
        </div>
        <p className="break-all text-[12px] text-ink-muted">{this.state.error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-md border border-outline px-2.5 py-1 text-[12px] text-ink hover:bg-surface-muted"
        >
          Try again
        </button>
      </div>
    );
  }
}

