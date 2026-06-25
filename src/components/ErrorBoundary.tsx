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
        <div style={{ padding: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#EBF5E2", border: "1px solid #000000", borderRadius: 8, padding: 24, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, background: "#D4EABD", border: "1px solid #000000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 }}>!</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#000000", marginBottom: 6 }}>Something went wrong</h2>
            <p style={{ fontSize: 12, color: "#000000", marginBottom: 16 }}>An unexpected error occurred. Please try again or refresh.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{ height: 32, padding: "0 16px", fontWeight: 700, fontSize: 12, background: "#C9DEB5", border: "1px solid #000000", borderRadius: 4, cursor: "pointer", color: "#000000" }}
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                style={{ height: 32, padding: "0 16px", fontWeight: 700, fontSize: 12, background: "#EBF5E2", border: "1px solid #000000", borderRadius: 4, cursor: "pointer", color: "#000000" }}
              >
                Try Again
              </button>
            </div>
            {this.state.error && (
              <details style={{ marginTop: 12, textAlign: "left" }}>
                <summary style={{ fontSize: 11, color: "#000000", cursor: "pointer" }}>▶ Error Details</summary>
                <pre style={{ fontSize: 10, background: "#EBF5E2", border: "1px solid #000000", padding: 8, borderRadius: 4, marginTop: 6, overflowX: "auto", whiteSpace: "pre-wrap", color: "#000000" }}>
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
