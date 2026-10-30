"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeft,
    DoorOpen,
    GraduationCap,
    Loader2,
    Search,
    Users,
    type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CarouselItem, FilterCarousel } from "@/components/filter-carousel";
import {
    PlanningCalendar,
    type PlanningCalendarHandle,
    type PlanningEventArg,
} from "@/components/planning-calendar";
import { DrawerPlanningContent } from "@/components/drawer-planning-content";
import { AurionDownState } from "@/components/aurion-down-state";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { fadeIn, staggerGroup } from "@/lib/motion";
import { parseFromTitle } from "@/lib/utils/home";
import {
    fetchPalantirPlanning,
    fetchPalantirStatus,
    searchPalantir,
    searchPalantirPeople,
} from "@/lib/api/palantir";
import {
    PalantirEntity,
    PalantirEntityKind,
    PalantirStudent,
    PalantirTeacher,
} from "@/types/palantir";
import { Lesson } from "@/types/aurion";
import { PreparedLesson } from "@/types/home";
import { usePalantirTheme } from "@/lib/utils/experimental";
import {
    getClassCollesLessons,
    getRoomCollesLessons,
    getStudentCollesLessons,
    getTeacherCollesLessons,
} from "@/lib/utils/colles";
import { cn } from "@/lib/utils/cn";
import { PalantirBackdrop } from "./palantir-backdrop";
import "./palantir-theme.css";

const DEBOUNCE_MS = 300;

const kindIcons = {
    room: DoorOpen,
    group: Users,
    teacher: GraduationCap,
} as const;

type ResultRowProps = {
    icon: LucideIcon;
    label: string;
    detail?: string;
    badge: React.ReactNode;
    onSelect: () => void;
};

function ResultRow({ icon: Icon, label, detail, badge, onSelect }: ResultRowProps) {
    return (
        <button type="button" onClick={onSelect} className="w-full text-left">
            <Card className="transition-colors hover:bg-mauria-purple/5 dark:hover:bg-white/5">
                <CardContent className="flex items-center gap-3 py-3">
                    <Icon className="h-5 w-5 shrink-0 text-mauria-purple dark:text-white" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        {detail && (
                            <p className="truncate text-xs text-muted-foreground">
                                {detail}
                            </p>
                        )}
                    </div>
                    {badge}
                </CardContent>
            </Card>
        </button>
    );
}

export function PalantirPage() {
    const { t } = useTranslation();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const classified = usePalantirTheme();

    const [rawQuery, setRawQuery] = useState("");
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState<PalantirEntityKind | null>(null);
    const [selected, setSelected] = useState<PalantirEntity | null>(null);
    const [eventInfo, setEventInfo] = useState<PreparedLesson | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const calendarRef = useRef<PlanningCalendarHandle>(null);

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!classified) return;
        const id = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, [classified]);

    const eventClassNames = useCallback(
        (arg: PlanningEventArg) => {
            const start = arg.event.start?.getTime() ?? 0;
            const end = arg.event.end?.getTime() ?? 0;
            return start <= now && now < end ? ["pv-event-now"] : [];
        },
        [now]
    );

    useEffect(() => {
        const timeout = window.setTimeout(
            () => setQuery(rawQuery.trim()),
            DEBOUNCE_MS
        );
        return () => window.clearTimeout(timeout);
    }, [rawQuery]);

    const { data: search, isFetching: searching } = useQuery({
        queryKey: ["palantir", "search", query, kind],
        queryFn: () => searchPalantir(query, kind ? [kind] : undefined),
        enabled: query.length > 0,
        staleTime: 1000 * 60 * 5,
    });

    const { data: people } = useQuery({
        queryKey: ["palantir", "people", query],
        queryFn: () => searchPalantirPeople(query),
        enabled: query.length > 0 && kind === null,
        staleTime: 1000 * 60 * 5,
    });

    const { data: polledStatus } = useQuery({
        queryKey: ["palantir", "status"],
        queryFn: fetchPalantirStatus,
        refetchInterval: (q) =>
            q.state.data?.state === "building" ? 2000 : false,
        staleTime: 0,
    });

    const status = polledStatus ?? search?.status ?? null;
    const building = status?.state === "building";
    const indexEmpty = status?.state === "empty";

    const { data: lessons = [], isFetching: loadingPlanning } = useQuery<
        Lesson[]
    >({
        queryKey: ["palantir", "planning", selected?.kind, selected?.id],
        queryFn: async () => {
            if (!selected) return [];
            return (
                (await fetchPalantirPlanning(selected.kind, selected.id)) ?? []
            );
        },
        enabled: Boolean(selected),
        staleTime: 1000 * 60 * 5,
    });

    const colles = useMemo(() => {
        if (!selected) return [];
        switch (selected.kind) {
            case "room":
                return getRoomCollesLessons(selected.id);
            case "teacher":
                return getTeacherCollesLessons(selected.id);
            case "group":
                return selected.collesGroup
                    ? getStudentCollesLessons(
                          selected.label,
                          selected.collesGroup
                      )
                    : getClassCollesLessons(selected.label);
        }
    }, [selected]);
    const planningLessons = useMemo(
        () => [...lessons, ...colles],
        [lessons, colles]
    );

    const kindItems = useMemo<CarouselItem[]>(
        () => [
            { value: null, label: t("palantirPage.kinds.all") },
            { value: "room", label: t("palantirPage.kinds.room") },
            { value: "group", label: t("palantirPage.kinds.group") },
        ],
        [t]
    );

    const results = search?.results ?? [];
    const teachers: PalantirTeacher[] = people?.teachers ?? [];
    const students: PalantirStudent[] = people?.students ?? [];
    const hasPeople = teachers.length + students.length > 0;
    const progress =
        status && status.total > 0
            ? Math.round((status.done / status.total) * 100)
            : 0;

    if (selected) {
        return (
            <motion.div
                variants={staggerGroup}
                initial="hidden"
                animate="show"
                className={cn("space-y-4 py-4", classified && "palantir-void")}
            >
                {classified && <PalantirBackdrop compact />}
                <motion.div variants={fadeIn} className="space-y-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(null)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t("palantirPage.back")}
                    </Button>
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">
                            {selected.label}
                        </h2>
                        {selected.detail && (
                            <p className="text-sm text-muted-foreground">
                                {selected.detail}
                            </p>
                        )}
                    </div>
                </motion.div>

                {loadingPlanning ? (
                    <motion.div
                        variants={fadeIn}
                        className="flex flex-col items-center gap-2 py-16 text-muted-foreground"
                    >
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-sm">
                            {t("palantirPage.loading")}
                        </p>
                    </motion.div>
                ) : planningLessons.length === 0 ? (
                    <motion.p
                        variants={fadeIn}
                        className="py-16 text-center text-sm text-muted-foreground"
                    >
                        {t("palantirPage.noLessons")}
                    </motion.p>
                ) : (
                    <motion.section
                        variants={fadeIn}
                        className="rounded-lg overflow-hidden shadow-lg"
                    >
                        <PlanningCalendar
                            ref={calendarRef}
                            eventSources={[planningLessons]}
                            eventClassNames={
                                classified ? eventClassNames : undefined
                            }
                            onEventClick={(info) => {
                                const event = info.event.toJSON();
                                const {
                                    courseTitle,
                                    location,
                                    type,
                                    teacher,
                                } = parseFromTitle(event as Lesson);
                                setEventInfo({
                                    courseTitle,
                                    location,
                                    type,
                                    teacher,
                                    details: event,
                                } as unknown as PreparedLesson);
                                setDrawerOpen(true);
                            }}
                        />
                    </motion.section>
                )}

                <DrawerPlanningContent
                    drawerOpen={drawerOpen}
                    setDrawerOpen={setDrawerOpen}
                    eventInfo={eventInfo}
                />
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={staggerGroup}
            initial="hidden"
            animate="show"
            className={cn("space-y-4 py-4", classified && "palantir-void")}
        >
            {classified && (
                <PalantirBackdrop compact={query.length > 0 || building} />
            )}
            <motion.div variants={fadeIn} className="space-y-1">
                <h2 className="text-xl font-bold">{t("palantirPage.title")}</h2>
                <p className="text-sm text-muted-foreground">
                    {t("palantirPage.subtitle")}
                </p>
            </motion.div>

            <motion.div variants={fadeIn} className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={rawQuery}
                    onChange={(e) => setRawQuery(e.target.value)}
                    placeholder={t("palantirPage.placeholder")}
                    className="pl-9"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
            </motion.div>

            <motion.div variants={fadeIn}>
                <FilterCarousel
                    items={kindItems}
                    selected={kind}
                    onSelect={(value) =>
                        setKind(value as PalantirEntityKind | null)
                    }
                />
            </motion.div>

            {building && (
                <motion.div variants={fadeIn}>
                    <Card>
                        <CardContent className="space-y-2 py-4">
                            <p className="text-sm font-medium">
                                {t("palantirPage.indexing.title")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {status?.phase === "plannings"
                                    ? t("palantirPage.indexing.plannings")
                                    : t("palantirPage.indexing.events", {
                                          done: status?.done ?? 0,
                                          total: status?.total ?? 0,
                                      })}
                            </p>
                            <Progress value={progress} />
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            <div className="flex flex-1 flex-col justify-start">
                <AnimatePresence mode="popLayout">
                    {query.length === 0 ? (
                        <motion.p
                            key="hint"
                            variants={fadeIn}
                            className="pb-6 pt-16 text-center text-sm text-muted-foreground"
                        >
                            {t("palantirPage.hint")}
                        </motion.p>
                    ) : searching && results.length === 0 && !hasPeople ? (
                        <motion.div
                            key="searching"
                            variants={fadeIn}
                            className="flex justify-center py-12"
                        >
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </motion.div>
                    ) : results.length === 0 && !hasPeople ? (
                        <motion.div key="empty" variants={fadeIn}>
                            <div className="text-center py-12">
                                <div className="bg-mauria-card rounded-xl shadow-md p-8 max-w-md mx-auto">
                                    {aurionDown && indexEmpty ? (
                                        <AurionDownState
                                            message={t(
                                                "palantirPage.aurionDownMessage"
                                            )}
                                        />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            {indexEmpty
                                                ? t(
                                                      "palantirPage.indexing.wait"
                                                  )
                                                : t("palantirPage.noResults")}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.ul
                            key="results"
                            variants={staggerGroup}
                            className="space-y-2"
                        >
                            {[
                                ...results.map((entity) => ({
                                    key: `${entity.kind}-${entity.id}`,
                                    icon: kindIcons[entity.kind] ?? Search,
                                    label: entity.label,
                                    detail: entity.detail,
                                    onSelect: () => setSelected(entity),
                                    badge:
                                        entity.type === "Promotion" ? (
                                            <Badge variant="secondary">
                                                {t("palantirPage.promotion")}
                                            </Badge>
                                        ) : entity.count > 0 ? (
                                            <Badge variant="secondary">
                                                {t("palantirPage.lessonCount", {
                                                    count: entity.count,
                                                })}
                                            </Badge>
                                        ) : null,
                                })),
                                ...students.map((student) => ({
                                    key: `student-${student.groupId}-${student.lastName}`,
                                    icon: Users,
                                    label: `${student.firstName} ${student.lastName}`,
                                    detail: student.className,
                                    onSelect: () =>
                                        setSelected({
                                            kind: "group",
                                            id: student.groupId,
                                            label: student.className,
                                            detail: "",
                                            type: "Promotion",
                                            count: 0,
                                            collesGroup: student.collesGroup,
                                        }),
                                    badge: (
                                        <Badge variant="secondary">
                                            {t("palantirPage.student")}
                                        </Badge>
                                    ),
                                })),
                                ...teachers.map((teacher) => ({
                                    key: `teacher-${teacher.name}`,
                                    icon: GraduationCap,
                                    label: teacher.name,
                                    detail: undefined,
                                    onSelect: () =>
                                        setSelected({
                                            kind: "teacher",
                                            id: teacher.name,
                                            label: teacher.name,
                                            detail: "",
                                            type: "",
                                            count: teacher.lessons,
                                        }),
                                    badge: (
                                        <Badge variant="secondary">
                                            {t("palantirPage.lessonCount", {
                                                count: teacher.lessons,
                                            })}
                                        </Badge>
                                    ),
                                })),
                            ].map((row) => (
                                <motion.li key={row.key} variants={fadeIn}>
                                    <ResultRow
                                        icon={row.icon}
                                        label={row.label}
                                        detail={row.detail}
                                        onSelect={row.onSelect}
                                        badge={row.badge}
                                    />
                                </motion.li>
                            ))}
                        </motion.ul>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
