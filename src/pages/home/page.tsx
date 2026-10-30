import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

import { buildWidgetLessons, getHomeUpcoming } from "@/lib/utils/home";
import { applyExtraTime, useExtraTimeEnabled } from "@/lib/utils/extra-time";
import { hasWidgetPlugin, pushWidgetPlanning } from "@/lib/native/widget";
import { useWidgetGradesSync } from "@/lib/native/widget";
import { staggerGroup } from "@/lib/motion";
import { EMPTY_MESSAGES, fetchImportantMessage, getFirstName } from "@/lib/api/helper";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { useAurionWarm } from "@/lib/hooks/use-aurion-warm";
import { EMPTY_LESSONS, planningQueryOptions, useColles, useResolvedPlanning } from "@/lib/hooks/use-colles";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PullToRefresh } from "@/components/pull-to-refresh";

import {
    EmptyState,
    ImportantMessage,
    JuniaStatusWarning,
    LessonsSection,
    WelcomeHeader,
} from "./sections";
import { RestaurantsSection } from "./restaurants";
import { DrawerPlanningContent } from "@/components/drawer-planning-content";
import { PreparedLesson } from "@/types/home";
import { useTranslation } from "react-i18next";
import { addDays, startOfDay, toDate } from "@/lib/utils/date-time";


export function HomePage() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [currentLesson, setCurrentLesson] = useState<PreparedLesson | null>(
        null
    );
    const { t } = useTranslation();
    const { isWarming } = useAurionWarm();
    const juniaStatus = useJuniaStatus();
    const aurionDown = juniaStatus?.aurionDown ?? false;
    const queryClient = useQueryClient();

    const { data: lessons = EMPTY_LESSONS, refetch, isLoading } = useQuery(
        planningQueryOptions(!isWarming && !aurionDown)
    );

    const isBusy = (isWarming && lessons.length === 0) || isLoading;

    const handleRefresh = () => {
        void queryClient.refetchQueries({ queryKey: ["importantMessages"] });
        void queryClient.refetchQueries({ queryKey: ["juniaStatus"] });
        void queryClient.refetchQueries({ queryKey: ["dailyMenu"] });
        void queryClient.refetchQueries({ queryKey: ["castelRuMenu"] });
        return refetch();
    };

    const { data: importantMessages = EMPTY_MESSAGES } = useQuery({
        queryKey: ["importantMessages"],
        queryFn: fetchImportantMessage,
        staleTime: 1000 * 60 * 5, 
        gcTime: 1000 * 60 * 5, 
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });

    const colles = useColles();
    const resolvedLessons = useResolvedPlanning(lessons);

    useEffect(() => {
        let timer: number | undefined;
        let cancelled = false;

        const boundary = (): number => {
            const now = Date.now();
            const midnight = startOfDay(addDays(new Date(now), 1)).getTime();
            let next = midnight;
            for (const l of resolvedLessons) {
                const start = toDate(l.start).getTime();
                const end = toDate(l.end).getTime();
                if (start > now && start < next) next = start;
                if (end > now && end < next) next = end;
            }
            return next;
        };

        const schedule = () => {
            if (cancelled) return;
            window.clearTimeout(timer);
            if (document.hidden) return;
            const delay = Math.max(15_000, boundary() - Date.now());
            timer = window.setTimeout(() => {
                if (cancelled || document.hidden) return;
                void refetch();
                schedule();
            }, delay);
        };

        const onVisibility = () => {
            if (document.hidden) {
                window.clearTimeout(timer);
            } else {
                schedule();
            }
        };

        schedule();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [resolvedLessons, refetch]);

    const extraTimeEnabled = useExtraTimeEnabled();
    const shownLessons = useMemo(
        () => applyExtraTime(resolvedLessons, extraTimeEnabled),
        [resolvedLessons, extraTimeEnabled]
    );

    const { current, today, tomorrow } = getHomeUpcoming({
        lessons: [...shownLessons, ...colles],
    });

    useEffect(() => {
        if (shownLessons.length === 0 || !hasWidgetPlugin()) return;
        void pushWidgetPlanning(
            buildWidgetLessons([...shownLessons, ...colles])
        );
    }, [shownLessons, colles]);

    useWidgetGradesSync();
    const [firstName, setFirstName] = useState<string>(t("homePage.welcome"));

    useEffect(() => {
        const loadFirstName = async () => {
            try {
                const name = await getFirstName();
                setFirstName(name || t("homePage.welcome"));
            } catch {
                setFirstName(t("homePage.welcome"));
            }
        };
        loadFirstName();
    }, [t]);

    const openLesson = (lesson: PreparedLesson) => () => {
        setDrawerOpen(true);
        setCurrentLesson(lesson);
    };

    const sections = [
        { title: t("homePage.current"), lessons: current ? [current] : [], keyPrefix: "current" },
        { title: t("homePage.today"), lessons: today, keyPrefix: "today" },
        {
            title: t("homePage.tomorrow"),
            lessons: current || today.length > 0 ? [] : tomorrow,
            keyPrefix: "tomorrow",
        },
    ].filter((section) => section.lessons.length > 0);

    return (
        <PullToRefresh
            onRefresh={handleRefresh}
            isPullable={!isBusy}
            pullingText={t("common.pullToRefresh")}
            refreshingText={t("common.refreshing")}
        >
            <motion.div variants={staggerGroup} initial="hidden" animate="show">
                <WelcomeHeader firstName={firstName} />
                <ImportantMessage messages={importantMessages} />
                <JuniaStatusWarning status={juniaStatus} />
                <RestaurantsSection />

                {sections.map((section) => (
                    <LessonsSection
                        key={section.keyPrefix}
                        title={section.title}
                        lessons={section.lessons}
                        keyPrefix={section.keyPrefix}
                        onClick={openLesson}
                    />
                ))}
                {sections.length === 0 && <EmptyState />}
            </motion.div>
            <DrawerPlanningContent
                drawerOpen={drawerOpen}
                setDrawerOpen={setDrawerOpen}
                eventInfo={currentLesson}
            />
        </PullToRefresh>
    );
}
