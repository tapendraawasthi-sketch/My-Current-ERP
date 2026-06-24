import React, { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

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
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#E4F1D9" }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#EBF5E2", border: "1px solid #000000", borderRadius: 8, padding: 32, textAlign: "center" }}>
            <div style={{ width: 60, height: 60, background: "#D4EABD", border: "1px solid #000000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>!</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#000000", marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 12, color: "#000000", marginBottom: 24 }}>An unexpected error occurred. Please refresh the page to continue.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{ height: 36, padding: "0 20px", fontWeight: 700, fontSize: 12, background: "#C9DEB5", border: "1px solid #000000", borderRadius: 4, cursor: "pointer", color: "#000000" }}
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                style={{ height: 36, padding: "0 20px", fontWeight: 700, fontSize: 12, background: "#EBF5E2", border: "1px solid #000000", borderRadius: 4, cursor: "pointer", color: "#000000" }}
              >
                Try Again
              </button>
            </div>
            {this.state.error && (
              <details style={{ marginTop: 16, textAlign: "left" }}>
                <summary style={{ fontSize: 11, color: "#000000", cursor: "pointer" }}>Error Details</summary>
                <pre style={{ fontSize: 10, background: "#EBF5E2", border: "1px solid #000000", padding: 8, borderRadius: 4, marginTop: 8, overflowX: "auto", whiteSpace: "pre-wrap", color: "#000000" }}>
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
