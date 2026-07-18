import { Component, type ReactNode } from 'react';

interface Props {
  chapterLabel: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ResultChapterLoadBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error(`${this.props.chapterLabel} chapter could not be loaded.`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-2xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
          {this.props.chapterLabel} could not be prepared. The post-scan overview and other chapters remain available.
        </div>
      );
    }
    return this.props.children;
  }
}

export function ResultChapterLoading({ chapterLabel }: { chapterLabel: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-border/60 bg-secondary/15 px-4 py-3 text-sm text-muted-foreground">
      Preparing {chapterLabel} details…
    </div>
  );
}
