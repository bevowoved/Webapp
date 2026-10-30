import { FormEvent, useMemo, useState } from "react";
import { addHours, isSameDay, startOfDay, startOfHour } from "@/lib/utils/date-time";
import { BookOpen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "./ui/drawer";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ChipButton, DayChips, TimeField, TimeGrid } from "./date-time-fields";
import { atTime, formatTime, toTime, useHour12 } from "@/lib/utils/date-time";
import { saveTaskToLocalStorage } from "@/lib/utils/agenda";
import { findNextLessonOfCurrentCourse } from "@/lib/utils/home";
import { usePlanning } from "@/lib/hooks/use-colles";
import { useColles } from "@/lib/hooks/use-colles";
import { TaskData } from "@/types/data";

const QUICK_TIMES = ["08:00", "12:00", "18:00", "23:59"];

const startsWithVowel = (course: string) =>
    /^[aeiouyàâéèêëîïôûùœ]/i.test(course.trim());

type FormProps = {
    open: boolean;
    task?: TaskData | null;
    onSaved: () => void;
    onDelete?: (task: TaskData) => void;
    onClose: () => void;
};

const dueOf = (task?: TaskData | null) =>
    task ? new Date(task.date) : startOfHour(addHours(new Date(), 1));

function DrawerTaskForm({ open, task, onSaved, onDelete, onClose }: FormProps) {
    const { t } = useTranslation();
    const hour12 = useHour12();
    const isEdit = Boolean(task);

    const [title, setTitle] = useState(task?.task ?? "");
    const [notes, setNotes] = useState(task?.notes ?? "");
    const [day, setDay] = useState(() => startOfDay(dueOf(task)));
    const [time, setTime] = useState(() => toTime(dueOf(task)));
    const [timeOpen, setTimeOpen] = useState(false);
    const [session, setSession] = useState(() => ({ open, task }));

    if (session.open !== open || session.task?.id !== task?.id) {
        setSession({ open, task });
        if (open) {
            const due = dueOf(task);
            setTitle(task?.task ?? "");
            setNotes(task?.notes ?? "");
            setDay(startOfDay(due));
            setTime(toTime(due));
            setTimeOpen(false);
        }
    }

    const planning = usePlanning();
    const colles = useColles();
    const nextLesson = useMemo(
        () => findNextLessonOfCurrentCourse([...planning, ...colles]),
        [planning, colles]
    );

    const canSubmit = title.trim() !== "" && time !== "";

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        saveTaskToLocalStorage({
            task: {
                id: task?.id ?? crypto.randomUUID(),
                task: title.trim(),
                date: atTime(day, time),
                notes: notes.trim() || undefined,
            },
        });
        toast.success(
            t(isEdit ? "agendaPage.taskUpdated" : "agendaPage.taskAdded"),
            { duration: 3000 }
        );
        onSaved();
        onClose();
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5 overflow-y-auto px-4 pb-4"
        >
            <div className="space-y-2">
                <Label htmlFor="task-title">{t("agendaPage.taskTitle")}</Label>
                <Input
                    id="task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("agendaPage.taskTitlePlaceholder")}
                    maxLength={120}
                    enterKeyHint="done"
                />
            </div>

            <div className="space-y-2">
                <Label>{t("agendaPage.dueDate")}</Label>
                <DayChips
                    day={day}
                    onChange={setDay}
                    extra={
                        nextLesson && (
                            <ChipButton
                                className="h-auto max-w-full py-1.5 text-left whitespace-normal"
                                active={
                                    isSameDay(day, nextLesson.start) &&
                                    time === toTime(nextLesson.start)
                                }
                                onClick={() => {
                                    setDay(startOfDay(nextLesson.start));
                                    setTime(toTime(nextLesson.start));
                                    setTimeOpen(false);
                                }}
                            >
                                <BookOpen className="h-4 w-4 shrink-0" />
                                {t(
                                    startsWithVowel(nextLesson.course)
                                        ? "agendaPage.nextLessonElided"
                                        : "agendaPage.nextLesson",
                                    { course: nextLesson.course }
                                )}
                            </ChipButton>
                        )
                    }
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="task-time">{t("agendaPage.dueTime")}</Label>
                <TimeField
                    id="task-time"
                    value={time}
                    hour12={hour12}
                    active={timeOpen}
                    onClick={() => setTimeOpen((o) => !o)}
                />
                {timeOpen && (
                    <TimeGrid value={time} hour12={hour12} onChange={setTime} />
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                    {QUICK_TIMES.map((quick) => (
                        <ChipButton
                            key={quick}
                            active={time === quick}
                            onClick={() => {
                                setTime(quick);
                                setTimeOpen(false);
                            }}
                        >
                            {formatTime(quick, hour12)}
                        </ChipButton>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="task-notes">{t("agendaPage.notes")}</Label>
                <Textarea
                    id="task-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("agendaPage.optional")}
                    rows={2}
                    maxLength={500}
                />
            </div>

            <div className={task && onDelete ? "grid grid-cols-2 gap-3" : ""}>
                {task && onDelete && (
                    <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(task)}
                    >
                        <Trash2 className="h-4 w-4" />
                        {t("agendaPage.delete")}
                    </Button>
                )}
                <Button type="submit" className="w-full" disabled={!canSubmit}>
                    {t(isEdit ? "agendaPage.save" : "agendaPage.createTaskBtn")}
                </Button>
            </div>
        </form>
    );
}

export function DrawerTask({
    open,
    onOpenChange,
    task,
    onSaved,
    onDelete,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: TaskData | null;
    onSaved: () => void;
    onDelete?: (task: TaskData) => void;
}) {
    const { t } = useTranslation();
    const isEdit = Boolean(task);

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent
                className="bg-mauria-card shadow-2xl max-h-[92dvh]"
                aria-describedby={undefined}
            >
                <DrawerHeader className="text-left">
                    <DrawerTitle>
                        {t(
                            isEdit
                                ? "agendaPage.editTaskTitle"
                                : "agendaPage.addTask"
                        )}
                    </DrawerTitle>
                </DrawerHeader>
                <DrawerTaskForm
                    open={open}
                    task={task}
                    onSaved={onSaved}
                    onDelete={onDelete}
                    onClose={() => onOpenChange(false)}
                />
            </DrawerContent>
        </Drawer>
    );
}
