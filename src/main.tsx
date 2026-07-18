import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function renderApp() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('omega18Qa') === 'persistence') {
    await import('./dev/accountPersistenceQaBootstrap');
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void renderApp();
