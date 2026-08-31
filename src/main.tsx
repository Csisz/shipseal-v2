import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function renderApp() {
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && (params.get('omega18Qa') === 'persistence' || params.get('omega20Continuity') === '1')) {
    await import('./dev/accountPersistenceQaBootstrap');
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void renderApp();
