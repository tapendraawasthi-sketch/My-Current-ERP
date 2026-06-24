import React, { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-xl p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-[18px] font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-[12px] text-gray-500 mb-6">An unexpected error occurred. Please refresh the page to continue.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => window.location.reload()} className="h-9 px-5 font-semibold text-[12px] bg-[#1557b0] text-white rounded-lg hover:bg-[#0f4a96]">Refresh Page</button>
              <button onClick={() => this.setState({ hasError: false })} className="h-9 px-5 font-semibold text-[12px] border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Try Again</button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-[11px] text-gray-400 cursor-pointer">Error Details (click to expand)</summary>
                <pre className="text-[10px] bg-gray-50 p-3 rounded mt-2 overflow-auto text-red-600 whitespace-pre-wrap">{this.state.error.toString()}{"\n"}{(this.state.error as any).stack || ""}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
