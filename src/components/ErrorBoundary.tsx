import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Download, RotateCcw } from "lucide-react";
import { Btn } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught LifeLog error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetHash = () => {
    window.location.hash = "#dashboard";
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleDownloadDiagnostic = () => {
    const report = {
      timestamp: new Date().toISOString(),
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifelog-diagnostic-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6" style={{ background: "var(--bg, #ffffff)", color: "var(--text, #182019)" }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--line, #e2e8f0)", background: "var(--panel, #ffffff)" }}>
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle size={28} />
              <h2 className="font-display text-[20px] font-bold">Something went wrong</h2>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--mut, #64748b)" }}>
              LifeLog encountered an unexpected error. Your data in IndexedDB is safe and was not affected.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-xl border p-3 font-mono text-[11px]" style={{ borderColor: "var(--line, #e2e8f0)", background: "var(--bg, #f8fafc)" }}>
                {this.state.error.toString()}
              </pre>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Btn variant="primary" onClick={this.handleReload}>
                <RotateCcw size={13} /> Reload LifeLog
              </Btn>
              <Btn variant="soft" onClick={this.handleResetHash}>
                Return to Dashboard
              </Btn>
              <Btn variant="outline" onClick={this.handleDownloadDiagnostic}>
                <Download size={13} /> Export Diagnostic
              </Btn>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
