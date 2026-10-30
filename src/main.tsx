import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@/i18n";
import "@/styles/globals.css";
import { ErrorBoundary } from "./components/error-boundary.tsx";
import { initSentry } from "./lib/sentry.ts";

// Before the first render: a throw during startup or on a pre-auth route must be
// reportable. captureException is a silent no-op when no client is bound, and the
// SDK is already in the entry chunk, so this costs nothing.
initSentry();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);
