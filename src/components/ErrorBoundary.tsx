import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected studio error.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Studio ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let parsedDetail = this.state.errorMessage;
      try {
        const maybeJson = JSON.parse(this.state.errorMessage);
        if (maybeJson && maybeJson.error) {
          parsedDetail = `${maybeJson.error} (Operation: ${maybeJson.operationType || 'unknown'}, Path: ${maybeJson.path || 'n/a'})`;
        }
      } catch {
        // Plain message
      }

      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/85 backdrop-blur-xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Studio Recovery Safeguard
              </h2>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed break-words">
              {parsedDetail}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Studio Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
