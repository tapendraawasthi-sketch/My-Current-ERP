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
        <div className="p-6 flex items-center justify-center min-h-[50vh]">
          <div className="max-w-[420px] w-full bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 border border-red-200 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 text-[22px] font-bold">
              !
            </div>
            <h2 className="text-[16px] font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-[12px] text-gray-600 mb-4">
              An unexpected error occurred. Please try again or refresh.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="h-8 px-4 font-semibold text-[12px] bg-[#1557b0] hover:bg-[#0f4a96] border border-transparent rounded cursor-pointer text-white transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="h-8 px-4 font-semibold text-[12px] bg-white border border-gray-300 rounded cursor-pointer text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-[11px] font-semibold text-gray-500 cursor-pointer hover:text-gray-700">
                  ▶ Error Details
                </summary>
                <pre className="text-[10px] bg-gray-50 border border-gray-200 p-2 rounded mt-2 overflow-x-auto whitespace-pre-wrap text-gray-700 font-mono">
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
