import { FormEvent, useState } from "react";
import {
    addHours,
    addMinutes,
    differenceInMinutes,
    endOfDay,
    isSameDay,
    min,
    startOfDay,
    startOfHour,
} from "@/lib/utils/date-time";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "./ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "./ui/drawer";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ChipButton, DayChips, TimeField, TimeGrid } from "./date-time-fields";
import { atTime, toTime, useHour12 } from "@/lib/utils/date-time";
import { saveUserEventToLocalStorage } from "@/lib/utils/planning";
import { UserEvent } from "@/types/data";

const DURATIONS = [30, 60, 90, 120];

const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest} min`;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
};

const defaultSlot = () => {
    const start = startOfHour(addHours(new Date(), 1));
    return { start, end: addHours(start, 1) };
};

export type UserEventSlot = { start: Date; end: Date };

export function DrawerUserEvent({
    open,
    onOpenChange,
    userEvent,
    slot,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userEvent?: UserEvent | null;
    slot?: UserEventSlot | null;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const isEdit = Boolean(userEvent);

    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [notes, setNotes] = useState("");
    const [day, setDay] = useState(() => startOfDay(new Date()));
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [openTime, setOpenTime] = useState<"start" | "end" | null>(null);
    const [session, setSession] = useState(() => ({ open, userEvent, slot }));
    const hour12 = useHour12();

    const toggleTime = (field: "start" | "end") =>
        setOpenTime((current) => (current === field ? null : field));

    if (
        session.open !== open ||
        session.userEvent?.id !== userEvent?.id ||
        session.slot?.start.getTime() !== slot?.start.getTime()
    ) {
        setSession({ open, userEvent, slot });
        if (open) {
            const range = userEvent
                ? { start: new Date(userEvent.start), end: new Date(userEvent.end) }
                : (slot ?? defaultSlot());
            setTitle(userEvent?.title ?? "");
            setLocation(userEvent?.location ?? "");
            setNotes(userEvent?.notes ?? "");
            setDay(startOfDay(range.start));
            setOpenTime(null);
            setStartTime(toTime(range.start));
            setEndTime(isSameDay(range.start, range.end) ? toTime(range.end) : "23:59");
        }
    }

    const start = atTime(day, startTime);
    const end = atTime(day, endTime);
    const duration = differenceInMinutes(end, start);
    const timesValid = Boolean(startTime && endTime) && duration > 0;
    const canSubmit = title.trim() !== "" && timesValid;

    const handleStartChange = (value: string) => {
        if (value && duration > 0) {
            const shifted = addMinutes(atTime(day, value), duration);
            setEndTime(toTime(min([shifted, endOfDay(day)])));
        }
        setStartTime(value);
    };

    const handleDuration = (minutes: number) => {
        setEndTime(toTime(min([addMinutes(start, minutes), endOfDay(day)])));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        saveUserEventToLocalStorage({
            userEvent: {
                id: userEvent?.id ?? crypto.randomUUID(),
                title: title.trim(),
                location: location.trim() || undefined,
                notes: notes.trim() || undefined,
                start: start.toISOString(),
                end: end.toISOString(),
                allDay: false,
                editable: false,
                className: "est-perso",
            },
        });
        toast.success(
            t(
                isEdit
                    ? "schedulePage.userEvents.updated"
                    : "schedulePage.userEvents.added"
            ),
            { duration: 3000 }
        );
        onSaved();
        onOpenChange(false);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent
                className="bg-mauria-card shadow-2xl max-h-[92dvh]"
                {...(isEdit && { "aria-describedby": undefined })}
            >
                <DrawerHeader className="text-left">
                    <DrawerTitle>
                        {t(
                            isEdit
                                ? "schedulePage.userEvents.editTitle"
                                : "schedulePage.userEvents.addTitle"
                        )}
                    </DrawerTitle>
                    {!isEdit && (
                        <DrawerDescription>
                            {t("schedulePage.userEvents.hint")}
                        </DrawerDescription>
                    )}
                </DrawerHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5 overflow-y-auto px-4 pb-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="user-event-title">
                            {t("schedulePage.userEvents.title")}
                        </Label>
                        <Input
                            id="user-event-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t(
                                "schedulePage.userEvents.titlePlaceholder"
                            )}
                            maxLength={80}
                            enterKeyHint="next"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="user-event-location">
                            {t("schedulePage.userEvents.location")}
                        </Label>
                        <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="user-event-location"
                                className="pl-9"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder={t(
                                    "schedulePage.userEvents.optional"
                                )}
                                maxLength={80}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t("schedulePage.userEvents.date")}</Label>
                        <DayChips day={day} onChange={setDay} />
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="user-event-start">
                                    {t("schedulePage.userEvents.start")}
                                </Label>
                                <TimeField
                                    id="user-event-start"
                                    value={startTime}
                                    hour12={hour12}
                                    active={openTime === "start"}
                                    onClick={() => toggleTime("start")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-event-end">
                                    {t("schedulePage.userEvents.end")}
                                </Label>
                                <TimeField
                                    id="user-event-end"
                                    value={endTime}
                                    hour12={hour12}
                                    active={openTime === "end"}
                                    invalid={!timesValid}
                                    onClick={() => toggleTime("end")}
                                />
                            </div>
                        </div>
                        {openTime && (
                            <TimeGrid
                                value={
                                    openTime === "start" ? startTime : endTime
                                }
                                hour12={hour12}
                                onChange={
                                    openTime === "start"
                                        ? handleStartChange
                                        : setEndTime
                                }
                            />
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                            {DURATIONS.map((minutes) => (
                                <ChipButton
                                    key={minutes}
                                    active={duration === minutes}
                                    onClick={() => handleDuration(minutes)}
                                    disabled={!startTime}
                                >
                                    {formatDuration(minutes)}
                                </ChipButton>
                            ))}
                        </div>
                        {!timesValid && startTime && endTime && (
                            <p className="text-sm text-destructive">
                                {t("schedulePage.userEvents.endBeforeStart")}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="user-event-notes">
                            {t("schedulePage.userEvents.notes")}
                        </Label>
                        <Textarea
                            id="user-event-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t("schedulePage.userEvents.optional")}
                            rows={2}
                            maxLength={500}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={!canSubmit}
                    >
                        {t(
                            isEdit
                                ? "schedulePage.userEvents.save"
                                : "schedulePage.userEvents.create"
                        )}
                    </Button>
                </form>
            </DrawerContent>
        </Drawer>
    );
}
