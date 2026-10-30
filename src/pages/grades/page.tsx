"use client";

import {
    ChevronDown,
    GraduationCap,
    Info,
    Package,
} from "lucide-react";
import { EmptyListState } from "@/components/aurion-down-state";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { GradeRevealOverlay } from "./reveal/grade-reveal-overlay";
import { BoosterEntryCard, BoosterOverlay } from "./reveal/pokemon/booster-overlay";
import { LootboxEntryCard, LootboxOverlay } from "./reveal/lootbox/lootbox-overlay";
import { GradeCard, GradeCardAnimate, UnopenedGradeCard } from "./grade-card";
import {
    getGrades,
    getGradeBadgeInfoFromCode,
    detectStudentClass,
    isCirClass,
    getGradeSemesters,
    getCurrentSemesterKey,
    computeAverages,
    computeAverageEvolution,
    parseFrDate,
} from "@/lib/utils/grades";
import { AnimatePresence, motion } from "framer-motion";
import { useWidgetGradesSync } from "@/lib/native/widget";
import { useQuery } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Grade } from "@/types/aurion";
import { EMPTY_GRADES, gradesQueryOptions } from "@/lib/hooks/use-colles";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { memo, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { fadeIn, staggerGroup } from "@/lib/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "@/lib/utils/date-time";
import { getDateLocale } from "@/lib/utils/translations";
import { useTranslation } from "react-i18next";
import {
    GradePositionSlider,
    GradesEvolutionChart as GradesEvolutionSvg,
    type EvolutionSeries,
} from "./grades-stats";
import { useGradeRevealMode } from "@/lib/utils/experimental";
import { useAurionWarm } from "@/lib/hooks/use-aurion-warm";
import { unlockSounds } from "@/lib/utils/sfx";
import {
    getGradeKey,
    openGrade,
    openGrades,
    repackGrade,
    useUnopenedGrades,
} from "@/lib/utils/unopened-grades";
import { CarouselItem, FilterCarousel } from "@/components/filter-carousel";

const AnimatedGradeCard = memo(GradeCardAnimate);
const StaticGradeCard = memo(GradeCard);

function splitStudentByComparison(
    data: Array<{ date: string; student: number | null; class: number | null }>
) {
    return data.map((point, i, arr) => {
        const { student } = point;
        const cls = point.class;
        if (student === null)
            return { ...point, studentAbove: null, studentBelow: null };

        const isAbove = cls === null || student >= cls;
        const prev = i > 0 ? arr[i - 1] : null;
        const prevIsAbove =
            prev && prev.student !== null
                ? prev.class === null || prev.student >= prev.class
                : isAbove;
        const isTransition = isAbove !== prevIsAbove;

        return {
            ...point,
            studentAbove:
                isAbove || (!isAbove && isTransition) ? student : null,
            studentBelow:
                !isAbove || (isAbove && isTransition) ? student : null,
        };
    });
}

function GradesEvolutionChart({
    grades,
    subject,
    t,
}: {
    grades: Grade[];
    subject: string | null;
    t: (key: string, opts?: Record<string, string>) => string;
}) {
    const { i18n } = useTranslation();
    const rawData = useMemo(() => computeAverageEvolution(grades), [grades]);
    const data = useMemo(() => splitStudentByComparison(rawData), [rawData]);

    if (data.length < 2) return null;

    const series: EvolutionSeries[] = [
        {
            key: "studentAbove",
            label: t("gradesPage.myAverage"),
            stroke: "hsl(var(--chart-student-above))",
            strokeWidth: 2,
        },
        {
            key: "studentBelow",
            label: t("gradesPage.myAverage"),
            stroke: "hsl(var(--chart-student-below))",
            strokeWidth: 2,
        },
        {
            key: "class",
            label: t("gradesPage.classAverage"),
            stroke: "hsl(var(--chart-class))",
            strokeWidth: 1.5,
            dash: "4 2",
            connectNulls: true,
        },
    ];

    const formatXDate = (dateStr: string) => {
        try {
            return format(
                parseFrDate(dateStr) ?? new Date(NaN),
                "d MMM",
                {
                    locale: getDateLocale(i18n.language),
                }
            );
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="pt-2 pb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                {subject
                    ? t("gradesPage.averageEvolutionIn", {
                          subject: t(subject),
                      })
                    : t("gradesPage.averageEvolutionGeneral")}
            </p>
            <GradesEvolutionSvg
                data={data}
                series={series}
                formatDate={formatXDate}
                className="h-36 w-full text-foreground"
            />
        </div>
    );
}

function AveragesComparison({
    grades,
    chartGrades,
    subject,
    t,
}: {
    grades: Grade[];
    chartGrades: Grade[];
    subject: string | null;
    t: (key: string, opts?: Record<string, string>) => string;
}) {
    const [expanded, setExpanded] = useState(false);
    const averages = useMemo(() => computeAverages(grades), [grades]);
    const isCir = useMemo(
        () => isCirClass(detectStudentClass(grades)),
        [grades]
    );

    if (averages.overall.student === null && averages.overall.class === null)
        return null;

    const fmt = (v: number | null) => (v !== null ? v.toFixed(2) : "—");
    const diff =
        (averages.overall.student ?? 0) - (averages.overall.class ?? 0);
    const aboveClass = diff > 0;
    const belowClass = diff < 0;

    return (
        <Card className="border-none bg-white shadow-md transition-transform duration-150 hover:-translate-y-0.5 dark:bg-mauria-card overflow-hidden">
            <CardContent className="p-3 space-y-2">
                <button
                    className="w-full flex cursor-pointer items-center justify-between gap-2"
                    onClick={() => setExpanded((v) => !v)}
                >
                    <div className="flex items-center gap-4">
                        <div className="text-left">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t("gradesPage.myAverage")}
                            </p>
                            <p
                                className={`text-xl font-bold ${aboveClass ? "text-green-700/70 dark:text-green-400/60 oled:text-green-300/65" : belowClass ? "text-amber-700/70 dark:text-amber-400/60 oled:text-amber-400/60" : "text-gray-400 dark:text-gray-500"}`}
                            >
                                {fmt(averages.overall.student)}
                            </p>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="text-left">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t("gradesPage.classAverage")}
                            </p>
                            <p className="text-xl font-bold text-gray-500 dark:text-gray-400">
                                {fmt(averages.overall.class)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{t("gradesPage.bySubject")}</span>
                        <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                        />
                    </div>
                </button>

                {expanded && (
                    <div className="space-y-1 pt-1">
                        <Separator />
                        {averages.bySubject.map((subject) => {
                            const d =
                                (subject.student ?? 0) - (subject.class ?? 0);
                            const isAbove = subject.student !== null && d >= 0;
                            const isBelow = subject.student !== null && d < 0;
                            return (
                                <div
                                    key={subject.labelKey}
                                    className="flex items-center justify-between py-1"
                                >
                                    <div className="flex items-baseline gap-1 min-w-0">
                                        <p
                                            className={`text-sm truncate ${subject.excluded ? "text-gray-300 dark:text-gray-600 line-through" : "text-gray-500 dark:text-gray-400"}`}
                                        >
                                            {t(subject.labelKey) ||
                                                subject.labelKey}
                                        </p>
                                        {subject.subjectCoef !== null &&
                                            !subject.excluded && (
                                                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 shrink-0">
                                                    ×{subject.subjectCoef}
                                                </span>
                                            )}
                                        {subject.excluded && (
                                            <span className="text-[10px] italic text-gray-300 dark:text-gray-600 shrink-0">
                                                {t("gradesPage.lv2NotCounted")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm font-medium shrink-0 ml-2">
                                        <span
                                            className={
                                                subject.excluded
                                                    ? "text-gray-300 dark:text-gray-600"
                                                    : isAbove
                                                      ? "text-green-700/70 dark:text-green-400/60 oled:text-green-300/65"
                                                      : isBelow
                                                        ? "text-amber-700/70 dark:text-amber-400/60 oled:text-amber-400/60"
                                                        : "text-gray-400 dark:text-gray-500"
                                            }
                                        >
                                            {fmt(subject.student)}
                                        </span>
                                        <span className="text-gray-300 dark:text-gray-600">
                                            /
                                        </span>
                                        <span
                                            className={
                                                subject.excluded
                                                    ? "text-gray-300 dark:text-gray-600"
                                                    : "text-gray-500 dark:text-gray-400"
                                            }
                                        >
                                            {fmt(subject.class)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        <Separator className="mt-2" />
                        <GradesEvolutionChart
                            grades={chartGrades}
                            subject={subject}
                            t={t}
                        />
                    </div>
                )}
                <div className="flex items-start gap-1.5 pt-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0 text-gray-400 dark:text-gray-500" />
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                        {t("gradesPage.averageDisclaimer")}
                    </p>
                </div>
                {isCir && (
                    <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] font-semibold"
                    >
                        {t("gradesPage.cirBeta")}
                    </Badge>
                )}
            </CardContent>
        </Card>
    );
}

export function GradesPage() {
    const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [openingGrade, setOpeningGrade] = useState<Grade | null>(null);
    const [boosterOpen, setBoosterOpen] = useState(false);
    const { t, i18n } = useTranslation();
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [semesterChoice, setSemesterChoice] = useState<
        string | null | undefined
    >(undefined);
    const { isWarming } = useAurionWarm();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;

    const {
        data: grades = EMPTY_GRADES,
        refetch,
        isLoading,
    } = useQuery(gradesQueryOptions(!isWarming && !aurionDown));

    const revealMode = useGradeRevealMode();
    const unopenedKeys = useUnopenedGrades();
    const isUnopened = (grade: Grade) =>
        revealMode !== "off" && unopenedKeys.has(getGradeKey(grade));

    const isBusy = (isWarming && grades.length === 0) || isLoading;

    const handleRefresh = () => refetch();

    useWidgetGradesSync(grades);

    const semesters = useMemo(() => getGradeSemesters(grades), [grades]);

    const semesterKey = useMemo(() => {
        if (semesterChoice !== undefined) return semesterChoice;
        const current = getCurrentSemesterKey();
        if (semesters.some((s) => s.key === current)) return current;
        return semesters[semesters.length - 1]?.key ?? null;
    }, [semesterChoice, semesters]);

    const filteredGrades = useMemo(
        () => getGrades({ semesterKey, grades }),
        [semesterKey, grades]
    );

    const availableSubjects = useMemo(() => {
        const keys = new Set<string>();
        for (const grade of filteredGrades) {
            const info = getGradeBadgeInfoFromCode(grade.code);
            if (info?.labelKey) keys.add(info.labelKey);
        }
        return [...keys].toSorted();
    }, [filteredGrades]);

    const displayedGrades = useMemo(() => {
        if (!selectedSubject) return filteredGrades;
        return filteredGrades.filter(
            (g) =>
                getGradeBadgeInfoFromCode(g.code)?.labelKey === selectedSubject
        );
    }, [filteredGrades, selectedSubject]);

    const openedFilteredGrades = useMemo(
        () =>
            revealMode !== "off"
                ? filteredGrades.filter(
                      (g) => !unopenedKeys.has(getGradeKey(g))
                  )
                : filteredGrades,
        [filteredGrades, revealMode, unopenedKeys]
    );
    const openedDisplayedGrades = useMemo(
        () =>
            revealMode !== "off"
                ? displayedGrades.filter(
                      (g) => !unopenedKeys.has(getGradeKey(g))
                  )
                : displayedGrades,
        [displayedGrades, revealMode, unopenedKeys]
    );

    const packMode = revealMode === "pokemon" || revealMode === "overwatch";
    const pendingGrades = useMemo(
        () =>
            packMode
                ? grades.filter((g) => unopenedKeys.has(getGradeKey(g)))
                : [],
        [grades, packMode, unopenedKeys]
    );
    const listedGrades = packMode ? openedDisplayedGrades : displayedGrades;

    const hasKnownClass = useMemo(
        () => detectStudentClass(filteredGrades) !== null,
        [filteredGrades]
    );

    const semesterItems = useMemo<CarouselItem[]>(
        () => [
            { value: null, label: t("common.allSemesters") },
            ...semesters.map((s) => ({
                value: s.key,
                label: t("common.semesterLabel", {
                    sem: s.sem,
                    year: s.yearLabel,
                }),
            })),
        ],
        [semesters, t]
    );

    const subjectItems = useMemo<CarouselItem[]>(
        () => [
            { value: null, label: t("gradesPage.allSubjects") },
            ...availableSubjects.map((s) => ({ value: s, label: t(s) })),
        ],
        [availableSubjects, t]
    );

    const filterKey = `${semesterKey ?? "all"}|${selectedSubject ?? "all"}`;

    return (
        <PullToRefresh
            onRefresh={handleRefresh}
            className="space-y-4 pt-4"
            isPullable={!isBusy}
            pullingText={t("common.pullToRefresh")}
            refreshingText={t("common.refreshing")}
        >
            <motion.div variants={staggerGroup} initial="hidden" animate="show">
                <motion.div variants={fadeIn} className="space-y-3 mb-4">
                    {semesters.length > 1 && (
                        <FilterCarousel
                            items={semesterItems}
                            selected={semesterKey}
                            onSelect={setSemesterChoice}
                        />
                    )}
                    {availableSubjects.length > 0 && (
                        <FilterCarousel
                            items={subjectItems}
                            selected={selectedSubject}
                            onSelect={setSelectedSubject}
                        />
                    )}
                </motion.div>

                <motion.div variants={fadeIn} className="space-y-3 pb-4">
                    {filteredGrades.length > 0 && (
                        <motion.div variants={fadeIn}>
                            {hasKnownClass ? (
                                <AveragesComparison
                                    grades={openedFilteredGrades}
                                    chartGrades={openedDisplayedGrades}
                                    subject={selectedSubject}
                                    t={t}
                                />
                            ) : (
                                <Card className="border-none bg-white shadow-md dark:bg-mauria-card overflow-hidden">
                                    <CardContent className="p-3 flex items-start gap-1.5">
                                        <Info className="h-3 w-3 mt-0.5 shrink-0 text-gray-400 dark:text-gray-500" />
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                                            {t(
                                                "gradesPage.averagesNotSupported"
                                            )}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </motion.div>
                    )}

                    <AnimatePresence mode="wait">
                        {displayedGrades.length === 0 ? (
                            <motion.div
                                key={`empty-${filterKey}`}
                                variants={fadeIn}
                                initial="hidden"
                                animate="show"
                                exit="exit"
                            >
                                <EmptyListState
                                    busy={isBusy}
                                    aurionDown={aurionDown}
                                    hasCachedItems={grades.length > 0}
                                    cachedMessage={t("gradesPage.noGradesCached")}
                                    icon={GraduationCap}
                                    emptyTitle={t("gradesPage.noGrades")}
                                    emptyBody={t("gradesPage.noGradesPlaceholder")}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key={`list-${filterKey}`}
                                className="space-y-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{
                                    opacity: 0,
                                    transition: { duration: 0.15 },
                                }}
                            >
                                <AnimatePresence mode="popLayout">
                                    {revealMode === "pokemon" && (
                                        <BoosterEntryCard
                                            key="booster"
                                            count={pendingGrades.length}
                                            onOpen={() => setBoosterOpen(true)}
                                        />
                                    )}
                                    {revealMode === "overwatch" && (
                                        <LootboxEntryCard
                                            key="lootbox"
                                            count={pendingGrades.length}
                                            onOpen={() => setBoosterOpen(true)}
                                        />
                                    )}
                                    {listedGrades.map((grade, index) =>
                                        isUnopened(grade) &&
                                        (revealMode === "cs2" ||
                                            revealMode === "fdj" ||
                                            revealMode === "slots") ? (
                                            <UnopenedGradeCard
                                                key={index}
                                                index={index}
                                                grade={grade}
                                                mode={revealMode}
                                                onOpen={(grade) => {
                                                    if (revealMode === "cs2") {
                                                        unlockSounds(
                                                            "cs2Tick",
                                                            "cs2Reveal"
                                                        );
                                                    }
                                                    setOpeningGrade(grade);
                                                }}
                                            />
                                        ) : index < 8 ? (
                                            <AnimatedGradeCard
                                                key={index}
                                                index={index}
                                                grade={grade}
                                                onGradeClick={(grade) => {
                                                    setSelectedGrade(grade);
                                                    setDrawerOpen(true);
                                                }}
                                            />
                                        ) : (
                                            <StaticGradeCard
                                                key={index}
                                                grade={grade}
                                                onGradeClick={(grade) => {
                                                    setSelectedGrade(grade);
                                                    setDrawerOpen(true);
                                                }}
                                            />
                                        )
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
            <GradeRevealOverlay
                grade={openingGrade}
                mode={revealMode}
                onClose={() => {
                    if (openingGrade) openGrade(openingGrade);
                    setOpeningGrade(null);
                }}
            />
            <BoosterOverlay
                open={boosterOpen && revealMode === "pokemon"}
                unopened={pendingGrades}
                onClose={(opened) => {
                    openGrades(opened);
                    setBoosterOpen(false);
                }}
            />
            <LootboxOverlay
                open={boosterOpen && revealMode === "overwatch"}
                unopened={pendingGrades}
                onClose={(opened) => {
                    openGrades(opened);
                    setBoosterOpen(false);
                }}
            />
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerContent aria-describedby={undefined}>
                    <DrawerHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                        <DrawerTitle>{t("gradesPage.details")}</DrawerTitle>
                        {revealMode !== "off" && selectedGrade && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                title={t("gradesPage.repack")}
                                onClick={() => {
                                    repackGrade(selectedGrade);
                                    setDrawerOpen(false);
                                }}
                                className="shrink-0"
                            >
                                {t("gradesPage.repackButton")}
                                <Package className="h-4 w-4" />
                            </Button>
                        )}
                    </DrawerHeader>
                    {selectedGrade && (
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto mb-6">
                            <div>
                                <h3 className="font-semibold text-lg text-black dark:text-white">
                                    {selectedGrade.name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedGrade.code}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 ">
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.grade")}
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {selectedGrade.grade}
                                    </p>
                                </div>
                            </div>
                            <GradePositionSlider grade={selectedGrade} />
                            <Separator />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.average")}
                                    </p>
                                    <p>{selectedGrade.average}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.median")}
                                    </p>
                                    <p>{selectedGrade.median}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.min")}
                                    </p>
                                    <p>{selectedGrade.min}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.max")}
                                    </p>
                                    <p>{selectedGrade.max}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.standardDeviation")}
                                    </p>
                                    <p>{selectedGrade.standardDeviation}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.coefficient")}
                                    </p>
                                    <p className="text-lg">
                                        {selectedGrade.coefficient}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium">
                                    {t("gradesPage.date")}
                                </p>
                                <p>
                                    {selectedGrade.date
                                        ? format(
                                              parseFrDate(selectedGrade.date) ??
                                                  new Date(NaN),
                                              "EEEE d MMM yyyy",
                                              {
                                                  locale: getDateLocale(
                                                      i18n.language
                                                  ),
                                              }
                                          )
                                        : t("gradesPage.dateNotSpecified")}
                                </p>
                            </div>

                            {selectedGrade.comment && (
                                <div>
                                    <p className="text-sm font-medium">
                                        {t("gradesPage.comment")}
                                    </p>
                                    <p className="text-sm">
                                        {selectedGrade.comment}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DrawerContent>
            </Drawer>
        </PullToRefresh>
    );
}
