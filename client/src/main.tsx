import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

class AppBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Marketlane could not render the interface.", error, info.componentStack);
  }

  render() {
    if (this.state.error) return <main className="fatal-error">
      <p className="eyebrow">MARKETLANE</p><h1>화면을 표시하지 못했습니다.</h1>
      <p>{this.state.error.message}</p><p>저장된 장바구니는 삭제하지 않았습니다. 새로고침해서 다시 열어 주세요.</p>
      <button className="button button-primary" onClick={() => window.location.reload()}>Marketlane 새로고침</button>
    </main>;
    return this.props.children;
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("Marketlane's root element is missing.");
createRoot(container).render(<StrictMode><AppBoundary><App /></AppBoundary></StrictMode>);
