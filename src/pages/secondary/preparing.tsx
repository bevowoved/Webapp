import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/progress-ring";
import { PageTransition } from "@/components/page-transition";
import { fadeIn } from "@/lib/motion";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import {
    PREFETCH_KEYS,
    clearPrefetchStarts,
    prefetchProgress,
    useWelcomePrefetch,
} from "@/lib/hooks/use-welcome-prefetch";

const preparingStagger = {
    hidden: {},
    show: { transition: { delayChildren: 0.15, staggerChildren: 0.12 } },
};

type QueryRow = {
    key: string;
    settled: boolean;
    isError: boolean;
    isSuccess: boolean;
    progress: number;
};

export function PreparingPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const status = useJuniaStatus();
    const { results, warm } = useWelcomePrefetch();

    const tips = t("welcome.tips", { returnObjects: true }) as string[];
    const [tipOrder] = useState(() => {
        const idx = tips.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        return idx;
    });
    const [tipStep, setTipStep] = useState(0);
    const tipIndex = tipOrder[tipStep % tipOrder.length] ?? 0;

    const anyPending =
        warm.status === "pending" ||
        results.some((result) => result.status === "pending");

    const [, setTick] = useState(0);
    useEffect(() => {
        if (!anyPending) return;
        const id = window.setInterval(() => setTick((n) => n + 1), 150);
        return () => window.clearInterval(id);
    }, [anyPending]);

    useEffect(() => {
        if (!anyPending) return;
        const id = window.setInterval(() => setTipStep((s) => s + 1), 2800);
        return () => window.clearInterval(id);
    }, [anyPending]);

    useEffect(() => {
        if (anyPending) return;
        const id = window.setTimeout(() => {
            clearPrefetchStarts();
            navigate("/", { replace: true });
        }, 700);
        return () => window.clearTimeout(id);
    }, [anyPending, navigate]);

    const rows: QueryRow[] = [
        {
            key: "warm",
            settled: warm.status !== "pending",
            isError: warm.status === "error",
            isSuccess: warm.status === "success",
        },
        ...results.map((result, index) => ({
            key: PREFETCH_KEYS[index],
            settled: result.status !== "pending",
            isError: result.isError,
            isSuccess: result.isSuccess,
        })),
    ].map((row) => ({
        ...row,
        progress: prefetchProgress(status, row.key, row.settled),
    }));

    return (
        <PageTransition className="min-h-screen bg-mauria-bg flex flex-col">
            <motion.div
                className="flex-1 flex flex-col gap-4 px-6 pt-16"
                variants={preparingStagger}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={fadeIn} className="pb-4 text-center">
                    <h1 className="text-3xl font-bold">
                        {t("preparationPage.title")}
                    </h1>
                </motion.div>
                <div className="space-y-3">
                    {rows.map(({ key, isError, isSuccess, progress }) => (
                        <motion.div key={key} variants={fadeIn}>
                            <Card className="flex items-center justify-between gap-3 border-none bg-white p-4 shadow-md dark:bg-mauria-card">
                                <span className="text-sm font-semibold text-foreground">
                                    {t(`preparationPage.queries.${key}`)}
                                </span>
                                {isError ? (
                                    <CircleX className="h-5 w-5 shrink-0 text-red-500" />
                                ) : isSuccess ? (
                                    <CircleCheck className="h-5 w-5 shrink-0 text-mauria-green" />
                                ) : (
                                    <span className="flex shrink-0 items-center gap-2 text-mauria-purple dark:text-mauria-accent">
                                        <span className="text-xs tabular-nums">
                                            {`${progress}%`}
                                        </span>
                                        <ProgressRing
                                            value={progress}
                                            size={20}
                                            strokeWidth={3}
                                            trackClassName="stroke-black/10 dark:stroke-white/20"
                                        />
                                    </span>
                                )}
                            </Card>
                        </motion.div>
                    ))}
                </div>
                <motion.p
                    variants={fadeIn}
                    aria-live="polite"
                    className="pt-2 min-h-[2.5rem] text-center text-sm text-muted-foreground leading-snug"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={anyPending ? tipStep : "idle"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                            {anyPending ? tips[tipIndex] : ""}
                        </motion.span>
                    </AnimatePresence>
                </motion.p>
            </motion.div>
        </PageTransition>
    );
}
