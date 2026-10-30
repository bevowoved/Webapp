import BottomNavigation from "@/components/bottom-navigation";
import { useBackground } from "@/components/background-provider";
import { PageTransition } from "@/components/page-transition";
import { ProgressRing } from "@/components/progress-ring";
import { AnimatePresence, motion } from "framer-motion";
import { useIsFetching } from "@tanstack/react-query";
import {
    lazy,
    memo,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/cn";
import { useFetchProgress } from "@/lib/hooks/use-fetch-progress";
import { BLINK_EVENT, useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { ServerCrash } from "lucide-react";

const Sidebar = lazy(() => import("@/components/sidebar"));
const NewUpdateDrawer = lazy(() => import("@/components/update-drawer"));
const FetchProgressDrawer = lazy(() =>
    import("@/components/fetch-progress-drawer").then((m) => ({
        default: m.FetchProgressDrawer,
    }))
);
const ParticlesLazy = lazy(() =>
    import("@/components/ui/shadcn-io/particles").then((m) => ({
        default: m.Particles,
    }))
);
const GridPatternLazy = lazy(() =>
    import("@/components/ui/shadcn-io/grid-pattern").then((m) => ({
        default: m.GridPattern,
    }))
);
const TopographyLazy = lazy(() =>
    import("@/components/ui/shadcn-io/topography").then((m) => ({
        default: m.Topography,
    }))
);
const DotPatternLazy = lazy(() =>
    import("@/components/ui/shadcn-io/dot-pattern").then((m) => ({
        default: m.DotPattern,
    }))
);

const BottomNav = memo(BottomNavigation);
const PageTransitionMemo = memo(PageTransition);

export default function RootLayout() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { background } = useBackground();
    const activeFetches = useIsFetching();
    const {
        progress: fetchProgress,
        visible: fetchSpinnerVisible,
        done: fetchDone,
        fetches,
    } = useFetchProgress();
    const [fetchDrawerOpen, setFetchDrawerOpen] = useState(false);
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const showGlobalSpinner = activeFetches > 0 || fetchSpinnerVisible;
    const [renderSpinner, setRenderSpinner] = useState(showGlobalSpinner);
    const [blinking, setBlinking] = useState(false);
    const blinkingRef = useRef(false);
    const triggerBlink = useCallback(() => {
        if (blinkingRef.current) return;
        blinkingRef.current = true;
        setBlinking(true);
    }, []);
    const endBlink = useCallback(() => {
        blinkingRef.current = false;
        setBlinking(false);
    }, []);

    useEffect(() => {
        if (aurionDown) return;
        const frame = requestAnimationFrame(endBlink);
        return () => cancelAnimationFrame(frame);
    }, [aurionDown, endBlink]);

    const shouldBlink = aurionDown && showGlobalSpinner;
    const wasBlinking = useRef(false);
    useEffect(() => {
        if (shouldBlink && !wasBlinking.current) triggerBlink();
        wasBlinking.current = shouldBlink;
    }, [shouldBlink, triggerBlink]);

    useEffect(() => {
        if (!aurionDown) return;
        window.addEventListener(BLINK_EVENT, triggerBlink);
        return () => window.removeEventListener(BLINK_EVENT, triggerBlink);
    }, [aurionDown, triggerBlink]);

    useEffect(() => {
        if (showGlobalSpinner) {
            const show = requestAnimationFrame(() => setRenderSpinner(true));
            return () => cancelAnimationFrame(show);
        }

        if (!renderSpinner) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setRenderSpinner(false);
        }, 250);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [showGlobalSpinner, renderSpinner]);

    const backgroundElement = useMemo(() => {
        switch (background) {
            case "particles":
                return (
                    <Suspense fallback={null}>
                        <ParticlesLazy
                            className="absolute inset-0 opacity-50 z-0"
                            staticity={10}
                            color="var(--particles-color)"
                            quantity={100}
                            ease={70}
                            size={1.5}
                        />
                    </Suspense>
                );
            case "grid":
                return (
                    <Suspense fallback={null}>
                        <div className="absolute inset-0 z-0 pointer-events-none">
                            <GridPatternLazy
                                squares={[]}
                                className={cn(
                                    "absolute left-0 w-full top-[-30%] h-[160vh] pointer-events-none transform",
                                    "[--mask-r:clamp(400px,70vw,3000px)]",
                                    "[mask-image:radial-gradient(var(--mask-r)_circle_at_center,white,transparent)]",
                                    "skew-y-12",
                                    "fill-current/50 stroke-current/50"
                                )}
                            />
                        </div>
                    </Suspense>
                );
            case "topography":
                return (
                    <Suspense fallback={null}>
                        <TopographyLazy className="absolute inset-0 z-0" />
                    </Suspense>
                );
            case "dot-pattern":
                return (
                    <Suspense fallback={null}>
                        <DotPatternLazy className="absolute inset-0 z-0" />
                    </Suspense>
                );
            default:
                return null;
        }
    }, [background]);

    return (
        <div className="flex flex-col min-h-full bg-mauria-bg overflow-hidden relative">
            {backgroundElement}
            <NewUpdateDrawer />
            <FetchProgressDrawer
                fetches={fetches}
                open={fetchDrawerOpen}
                onOpenChange={setFetchDrawerOpen}
            />
            <header className="flex items-center justify-between px-4 pb-4 pt-safe-offset-4 bg-mauria-purple oled:bg-black z-10">
                <h1
                    className="text-2xl font-bold text-white cursor-pointer"
                    onClick={() => {
                        if (location.pathname !== "/") navigate("/");
                    }}
                >
                    {t("welcome.mauria")}
                </h1>
                <div className="flex items-center gap-3">
                    <AnimatePresence initial={false}>
                        {renderSpinner && !aurionDown && (
                            <motion.div
                                key="sidebar-global-loader"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                    duration: 0.4,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                className="flex items-center text-white origin-center"
                            >
                                <button
                                    type="button"
                                    className="relative flex"
                                    disabled={fetches.length === 0}
                                    onClick={() => setFetchDrawerOpen(true)}
                                    aria-label={t("fetchDrawer.open")}
                                >
                                    <ProgressRing
                                        value={fetchProgress}
                                        size={28}
                                        strokeWidth={3}
                                    />
                                    <AnimatePresence>
                                        {fetchDone && (
                                            <motion.svg
                                                key="completion-check"
                                                viewBox="0 0 28 28"
                                                className="absolute inset-0"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{
                                                    duration: 0.2,
                                                    ease: "easeOut",
                                                }}
                                            >
                                                <motion.path
                                                    d="M9.5 14.5 L12.8 17.8 L18.5 10.8"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={3}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    initial={{
                                                        pathLength: 0,
                                                        opacity: 0,
                                                    }}
                                                    animate={{
                                                        pathLength: 1,
                                                        opacity: 1,
                                                    }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{
                                                        duration: 0.35,
                                                        ease: [0.16, 1, 0.3, 1],
                                                    }}
                                                />
                                            </motion.svg>
                                        )}
                                    </AnimatePresence>
                                </button>
                                <span className="sr-only">
                                    {t("common.loading")}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {blinking && aurionDown && (
                        <motion.div
                            className="flex items-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
                            transition={{ duration: 1.8, ease: "linear" }}
                            onAnimationComplete={endBlink}
                        >
                            <ServerCrash className="h-6 w-6 text-red-300 oled:text-red-400" />
                            <span className="sr-only">
                                {t("homePage.aurionDownTitle")}
                            </span>
                        </motion.div>
                    )}
                    <Suspense fallback={null}>
                        <Sidebar />
                    </Suspense>
                </div>
            </header>
            <AnimatePresence mode="popLayout" initial={false}>
                <PageTransitionMemo
                    as="main"
                    className="flex-1 px-4 pb-safe-offset-24 z-10"
                    key={location.pathname}
                >
                    <Outlet />
                </PageTransitionMemo>
            </AnimatePresence>

            <BottomNav />
        </div>
    );
}
