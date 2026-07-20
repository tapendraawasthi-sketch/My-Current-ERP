import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Sutra ERP Error]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 flex items-center justify-center min-h-[60vh] bg-[#f8fafc]">
          <div className="max-w-[440px] w-full bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-14 h-14 bg-red-50 border border-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-[24px] font-bold">
              !
            </div>
            <h2 className="text-[17px] font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">
              An unexpected error occurred. Please try again or refresh.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="h-9 px-5 font-semibold text-[13px] bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] border border-transparent rounded-lg cursor-pointer text-white transition-colors shadow-sm"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="h-9 px-5 font-semibold text-[13px] bg-white border border-gray-200 rounded-lg cursor-pointer text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-[12px] font-medium text-gray-400 cursor-pointer hover:text-gray-600">
                  ▶ Error Details
                </summary>
                <pre className="text-[11px] bg-gray-50 border border-gray-100 p-3 rounded-lg mt-2 overflow-x-auto whitespace-pre-wrap text-gray-600 font-mono leading-relaxed max-h-[200px] overflow-y-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
