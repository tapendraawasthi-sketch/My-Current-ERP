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
        <div className="min-h-screen flex items-center justify-center bg-[#E4F1D9]">
          <div className="max-w-md w-full bg-[#EBF5E2] border border-[#9DC07A] rounded-xl shadow-xl p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-[#D4EABD] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-[#3D6B25]" />
            </div>
            <h2 className="text-[18px] font-bold text-[#000000] mb-2">Something went wrong</h2>
            <p className="text-[12px] text-[#000000] mb-6">An unexpected error occurred. Please refresh the page to continue.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => window.location.reload()} className="h-9 px-5 font-semibold text-[12px] bg-[#3D6B25] text-white rounded-lg hover:bg-[#2D5A1A]">Refresh Page</button>
              <button onClick={() => this.setState({ hasError: false })} className="h-9 px-5 font-semibold text-[12px] border border-[#9DC07A] rounded-lg hover:bg-[#D4EABD]" style={{ background: "#EBF5E2", color: "#000000" }}>Try Again</button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-[11px] text-[#000000] cursor-pointer">Error Details (click to expand)</summary>
                <pre className="text-[10px] bg-[#EBF5E2] p-3 rounded mt-2 overflow-auto text-red-600 whitespace-pre-wrap">{this.state.error.toString()}{"\n"}{(this.state.error as any).stack || ""}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
