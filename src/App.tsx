import { lazy, Suspense, useEffect } from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useLocation,
} from "react-router";

import RootLayout from "./pages/layout";
import { ReactQueryProvider } from "./lib/query-client";
import { getSession } from "./lib/api/aurion";
import { useAurionWarm } from "./lib/hooks/use-aurion-warm";
import { useWidgetLanguageSync } from "./lib/native/widget";
import { ThemeProvider } from "./components/theme-provider";
import { MotionPreferences } from "./components/motion-preferences";
import { BackgroundProvider } from "./components/background-provider";
import { NotFound } from "./components/not-found";

const Toaster = lazy(() =>
    import("@/components/ui/sonner").then((m) => ({ default: m.Toaster }))
);

const HomePage = lazy(() =>
    import("./pages/home/page").then((m) => ({ default: m.HomePage }))
);
const PlanningPage = lazy(() =>
    import("./pages/planning/page").then((m) => ({ default: m.PlanningPage }))
);
const GradesPage = lazy(() =>
    import("./pages/grades/page").then((m) => ({ default: m.GradesPage }))
);
const AbsencesPage = lazy(() =>
    import("./pages/absences/page").then((m) => ({ default: m.AbsencesPage }))
);
const AssociationsPage = lazy(() =>
    import("./pages/secondary/associations").then((m) => ({
        default: m.AssociationsPage,
    }))
);
const DocumentsPage = lazy(() =>
    import("./pages/secondary/documents").then((m) => ({
        default: m.DocumentsPage,
    }))
);
const PrintPage = lazy(() =>
    import("./pages/secondary/print").then((m) => ({ default: m.PrintPage }))
);
const PalantirPage = lazy(() =>
    import("./pages/palantir/page").then((m) => ({ default: m.PalantirPage }))
);
const AgendaPage = lazy(() =>
    import("./pages/secondary/agenda").then((m) => ({ default: m.AgendaPage }))
);
const VersionsPage = lazy(() =>
    import("./pages/secondary/versions").then((m) => ({
        default: m.VersionsPage,
    }))
);
const SettingsPage = lazy(() =>
    import("./pages/secondary/settings").then((m) => ({
        default: m.SettingsPage,
    }))
);
const LoginPage = lazy(() =>
    import("./pages/secondary/login").then((m) => ({ default: m.LoginPage }))
);
const WelcomePage = lazy(() =>
    import("./pages/secondary/welcome").then((m) => ({
        default: m.WelcomePage,
    }))
);
const CampusPage = lazy(() =>
    import("./pages/secondary/campus").then((m) => ({ default: m.CampusPage }))
);
const PreparingPage = lazy(() =>
    import("./pages/secondary/preparing").then((m) => ({
        default: m.PreparingPage,
    }))
);
const PlanningPreviewPage = lazy(() =>
    import("./pages/dev/planning-preview").then((m) => ({
        default: m.PlanningPreviewPage,
    }))
);

const routeLoaders: Record<string, () => Promise<unknown>> = {
    "/": () => import("./pages/home/page"),
    "/planning": () => import("./pages/planning/page"),
    "/grades": () => import("./pages/grades/page"),
    "/absences": () => import("./pages/absences/page"),
    "/agenda": () => import("./pages/secondary/agenda"),
    "/associations": () => import("./pages/secondary/associations"),
    "/documents": () => import("./pages/secondary/documents"),
    "/print": () => import("./pages/secondary/print"),
    "/palantir": () => import("./pages/palantir/page"),
    "/versions": () => import("./pages/secondary/versions"),
    "/settings": () => import("./pages/secondary/settings"),
    "/welcome": () => import("./pages/secondary/welcome"),
    "/campus": () => import("./pages/secondary/campus"),
    "/preparing": () => import("./pages/secondary/preparing"),
    "/login": () => import("./pages/secondary/login"),
};

const preloaded = new Set<string>();

export function preloadRoute(path: string) {
    const key = path.split("?")[0].replace(/\/$/, "") || "/";
    const load = routeLoaders[key];
    if (!load || preloaded.has(key)) return;
    preloaded.add(key);
    void load().catch(() => {
        preloaded.delete(key);
    });
}

const CORE_ROUTES = ["/", "/planning", "/grades", "/absences", "/agenda"];

const connection = () =>
    (
        navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string };
        }
    ).connection;

const shouldPrefetch = () => {
    const c = connection();
    if (!c) return true;
    if (c.saveData) return false;
    return c.effectiveType !== "slow-2g" && c.effectiveType !== "2g";
};

function preloadCoreRoutes() {
    if (!shouldPrefetch()) return;
    for (const path of CORE_ROUTES) preloadRoute(path);
}

const whenIdle = (cb: () => void) => {
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(cb, { timeout: 2500 });
    } else {
        setTimeout(cb, 1200);
    }
};

const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();
    const connected = !!getSession();
    useAurionWarm();

    if (!connected) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
};

function AppRoutes() {
    const location = useLocation();

    return (
        <Suspense fallback={null}>
            <Routes location={location}>
                {import.meta.env.DEV && (
                    <Route
                        path="/dev/planning-preview"
                        element={<PlanningPreviewPage />}
                    />
                )}
                <Route path="/login/*" element={<LoginPage />} />
                <Route
                    path="/welcome"
                    element={
                        <RequireAuth>
                            <WelcomePage />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/campus"
                    element={
                        <RequireAuth>
                            <CampusPage />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/preparing"
                    element={
                        <RequireAuth>
                            <PreparingPage />
                        </RequireAuth>
                    }
                />
                <Route
                    element={
                        <RequireAuth>
                            <RootLayout />
                        </RequireAuth>
                    }
                >
                    <Route path="/" element={<HomePage />} />
                    <Route path="/planning" element={<PlanningPage />} />
                    <Route path="/grades" element={<GradesPage />} />
                    <Route path="/absences" element={<AbsencesPage />} />
                    <Route
                        path="/associations"
                        element={<AssociationsPage />}
                    />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/print" element={<PrintPage />} />
                    <Route path="/palantir" element={<PalantirPage />} />
                    <Route path="/agenda" element={<AgendaPage />} />
                    <Route path="/versions" element={<VersionsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    {/* Unknown URLs render inside the shell so the user keeps
                        navigation; without this the page is entirely blank. */}
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </Suspense>
    );
}

function useDeferredBoot() {
    useEffect(() => {
        if (!import.meta.env.PROD) return;
        whenIdle(preloadCoreRoutes);
    }, []);
}

function App() {
    const baseUrl = import.meta.env.BASE_URL ?? "/";
    const routerBaseName =
        baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

    useWidgetLanguageSync();
    useDeferredBoot();

    return (
        <ThemeProvider>
            <MotionPreferences>
                <BackgroundProvider defaultBackground="particles">
                    <Suspense fallback={null}>
                        <Toaster richColors position="top-center" />
                    </Suspense>
                    <BrowserRouter basename={routerBaseName}>
                        <ReactQueryProvider>
                            <AppRoutes />
                        </ReactQueryProvider>
                    </BrowserRouter>
                </BackgroundProvider>
            </MotionPreferences>
        </ThemeProvider>
    );
}

export default App;
