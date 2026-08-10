import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen flex items-center justify-center p-8"
          style={{ background: "linear-gradient(135deg, #080612 0%, #0d0a22 60%)" }}
        >
          <div
            className="max-w-md w-full rounded-2xl p-8 text-center"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,60,60,0.30)",
              boxShadow: "0 0 40px rgba(255,60,60,0.10)",
            }}
          >
            <p className="text-4xl mb-4">⚠️</p>
            <h2 className="text-lg font-bold text-white mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-sm text-red-400 font-mono mb-6 break-words">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: "linear-gradient(135deg, #00f0ff, #7000ff)" }}
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
