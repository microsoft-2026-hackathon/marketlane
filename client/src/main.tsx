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
      <p className="eyebrow">MARKETLANE</p><h1>This view could not be displayed.</h1>
      <p>{this.state.error.message}</p><p>Your saved drafts have not been cleared. Reload to open the workspace again.</p>
      <button className="button button-primary" onClick={() => window.location.reload()}>Reload Marketlane</button>
    </main>;
    return this.props.children;
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("Marketlane's root element is missing.");
createRoot(container).render(<StrictMode><AppBoundary><App /></AppBoundary></StrictMode>);
