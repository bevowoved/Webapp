import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fadeIn, staggerGroup } from "@/lib/motion";

import { PullToRefresh } from "@/components/pull-to-refresh";
import {
    PlanningCalendar,
    type PlanningCalendarHandle,
} from "@/components/planning-calendar";
import { parseFromTitle } from "@/lib/utils/home";
import {
    DrawerUserEvent,
    UserEventSlot,
} from "@/components/drawer-user-event";
import {
    getUserEventsFromLocalStorage,
    removeUserEventFromLocalStorage,
    saveUserEventToLocalStorage,
} from "@/lib/utils/planning";
import { UserEvent } from "@/types/data";
import { PreparedLesson } from "@/types/home";
import { DrawerPlanningContent } from "@/components/drawer-planning-content";
import { FreeRoomsView } from "./free-rooms-view";
import { addMinutes, formatLastUpdated, getDateLocale } from "@/lib/utils/date-time";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { exportCalendar } from "@/lib/utils/exportCalendar";
import { useAurionWarm } from "@/lib/hooks/use-aurion-warm";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { EMPTY_LESSONS, planningQueryOptions, useColles, useResolvedPlanning } from "@/lib/hooks/use-colles";
import { FREE_ROOMS_CAMPUSES, useCampus } from "@/lib/utils/campus";
import { applyExtraTime, useExtraTimeEnabled } from "@/lib/utils/extra-time";

export function PlanningPage() {
    const calendarRef = useRef<PlanningCalendarHandle>(null);
    const { t, i18n } = useTranslation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [eventInfo, setEventInfo] = useState<PreparedLesson | null>(null);
    const [userEvents, setUserEvents] = useState<UserEvent[]>(
        getUserEventsFromLocalStorage
    );
    const [formOpen, setFormOpen] = useState(false);
    const [editedEvent, setEditedEvent] = useState<UserEvent | null>(null);
    const [formSlot, setFormSlot] = useState<UserEventSlot | null>(null);
    const editTimeoutRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (editTimeoutRef.current !== null) {
                window.clearTimeout(editTimeoutRef.current);
            }
        },
        []
    );
    const [view, setView] = useState<"calendar" | "freeRooms">("calendar");
    const { isWarming } = useAurionWarm();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const showFreeRooms = FREE_ROOMS_CAMPUSES.includes(useCampus());

    const colles = useColles();

    const {
        data: lessons = EMPTY_LESSONS,
        refetch,
        isLoading,
        dataUpdatedAt,
    } = useQuery(planningQueryOptions(!isWarming && !aurionDown));

    const resolvedLessons = useResolvedPlanning(lessons);
    const extraTimeEnabled = useExtraTimeEnabled();

    const shownLessons = useMemo(
        () => applyExtraTime(resolvedLessons, extraTimeEnabled),
        [resolvedLessons, extraTimeEnabled]
    );

    const isBusy = (isWarming && lessons.length === 0) || isLoading;

    // `dataUpdatedAt` is 0 until the query resolves; formatting it would print
    // the 1970 epoch as if it were a real refresh time. Null means "omit".
    const lastUpdated = formatLastUpdated(
        dataUpdatedAt,
        getDateLocale(i18n.language)
    );

    const handleRefresh = () => refetch();

    const refreshUserEvents = useCallback(() => {
        setUserEvents(getUserEventsFromLocalStorage());
    }, []);

    const openEventForm = (slot: UserEventSlot | null) => {
        setEditedEvent(null);
        setFormSlot(slot);
        setFormOpen(true);
    };

    const isUserEventShown = eventInfo?.details.className === "est-perso";
    const selectedUserEvent = eventInfo
        ? userEvents.find((ue) => ue.id === eventInfo.details.id)
        : undefined;

    const handleEditUserEvent = () => {
        if (!selectedUserEvent) return;
        setEditedEvent(selectedUserEvent);
        setFormSlot(null);
        setDrawerOpen(false);
        editTimeoutRef.current = window.setTimeout(() => {
            editTimeoutRef.current = null;
            setFormOpen(true);
        }, 500);
    };

    const handleDeleteUserEvent = () => {
        if (!selectedUserEvent) return;
        const deleted = selectedUserEvent;
        removeUserEventFromLocalStorage({ userEventId: deleted.id });
        refreshUserEvents();
        setDrawerOpen(false);
        toast.success(t("schedulePage.userEvents.deleted"), {
            duration: 5000,
            action: {
                label: t("schedulePage.userEvents.undo"),
                onClick: () => {
                    saveUserEventToLocalStorage({ userEvent: deleted });
                    refreshUserEvents();
                },
            },
        });
    };

    const handleExport = () => {
        // `void` alone discards the promise, so any rejection disappears without a
        // trace: no file, no message, nothing to diagnose. Surface it instead.
        exportCalendar(lessons).catch(() => {
            toast.error(t("schedulePage.exportError"));
        });
    };

    return (
        <PullToRefresh
            onRefresh={handleRefresh}
            isPullable={view === "calendar" && !isBusy}
            pullingText={t("common.pullToRefresh")}
            refreshingText={t("common.refreshing")}
        >
            <motion.div variants={staggerGroup} initial="hidden" animate="show">
                <motion.div
                    variants={fadeIn}
                    className="flex items-center justify-between gap-2 mt-4 mb-6"
                >
                    <h2 className="text-3xl font-bold text-mauria-purple dark:text-white">
                        {t(
                            view === "calendar"
                                ? "schedulePage.title"
                                : "schedulePage.freeRooms.title"
                        )}
                    </h2>
                    {view === "calendar" ? (
                        <div className="flex items-center gap-2">
                            {showFreeRooms && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setView("freeRooms")}
                                >
                                    <Search className="h-4 w-4" />
                                    {t("schedulePage.freeRooms.button")}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                className="w-9 px-0"
                                onClick={() => openEventForm(null)}
                                aria-label={t(
                                    "schedulePage.userEvents.addTitle"
                                )}
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setView("calendar")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {t("schedulePage.freeRooms.back")}
                        </Button>
                    )}
                </motion.div>

                {view === "calendar" ? (
                    <motion.section
                        variants={fadeIn}
                        className="rounded-lg overflow-hidden shadow-lg"
                    >
                        <PlanningCalendar
                            ref={calendarRef}
                            lessons={[...shownLessons, ...userEvents, ...colles]}
                            onSelect={({ start, end }) => {
                                const span = end.getTime() - start.getTime();
                                openEventForm({
                                    start,
                                    end: span <= 30 * 60 * 1000 ? addMinutes(start, 60) : end,
                                });
                            }}
                            onEventClick={({ event }) => {
                                const userEvent = userEvents.find(
                                    (ue) => ue.id === event.id
                                );
                                if (userEvent) {
                                    setEventInfo({
                                        courseTitle: userEvent.title,
                                        location: userEvent.location ?? "",
                                        type: t(
                                            "schedulePage.userEvents.type"
                                        ),
                                        teacher: "",
                                        notes: userEvent.notes,
                                        time: "",
                                        details: userEvent,
                                    });
                                    setDrawerOpen(true);
                                    return;
                                }

                                const {
                                    courseTitle,
                                    location,
                                    type,
                                    teacher,
                                } = parseFromTitle(event.toJSON());
                                const mixedEvent = {
                                    courseTitle,
                                    location,
                                    type,
                                    teacher,
                                    details: event.toJSON(),
                                } as unknown as PreparedLesson;

                                setEventInfo(mixedEvent);
                                setDrawerOpen(true);
                            }}
                        />
                        {lastUpdated && (
                            <div className="text-sm font-semibold mt-2 ml-2 text-mauria-purple dark:text-gray-300">
                                {t("schedulePage.lastUpdate")} {lastUpdated}
                            </div>
                        )}
                        <Button
                            className="mt-2"
                            onClick={handleExport}
                            disabled={lessons.length === 0 || isBusy}
                        >
                            {t("schedulePage.exportSchedule")}
                        </Button>
                        <p className="mt-2 italic">
                            {t("schedulePage.warnExport")}
                        </p>
                    </motion.section>
                ) : (
                    <FreeRoomsView />
                )}
            </motion.div>
            <DrawerPlanningContent
                drawerOpen={drawerOpen}
                setDrawerOpen={setDrawerOpen}
                eventInfo={eventInfo}
                onEdit={isUserEventShown ? handleEditUserEvent : undefined}
                onDelete={isUserEventShown ? handleDeleteUserEvent : undefined}
            />
            <DrawerUserEvent
                open={formOpen}
                onOpenChange={setFormOpen}
                userEvent={editedEvent}
                slot={formSlot}
                onSaved={refreshUserEvents}
            />
        </PullToRefresh>
    );
}
