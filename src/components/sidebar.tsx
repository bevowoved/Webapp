"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
    Menu,
    HeartHandshake,
    BadgeX,
    ThumbsDown,
    Book,
    Printer,
    FileText,
    Radar,
    MailQuestionMark,
    ArrowDownRightFromSquare,
    Settings,
    type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";
import { preloadRoute } from "@/App";
import { useNavigate } from "react-router";
import { applyScale, readInitialSize } from "@/lib/utils/scale";
import { useQuery } from "@tanstack/react-query";
import { updatesQueryOptions } from "@/lib/api/helper";
import { useTranslation } from "react-i18next";
import { clearLogoutState } from "@/lib/query-client";
import { applyLocale, readInitialLocale } from "@/lib/utils/translations";

const aurionURL = "https://aurion.junia.com";
const juniaLearningURL = "https://junia-learning.com";
const contactURL =
    "mailto:louis.soltysiak@student.junia.com?subject=" +
    encodeURIComponent("Support/feature pour Mauria");
const githubURL = "https://github.com/MauriaApp";

const ROW = "group w-full justify-start gap-3 px-0 h-10 [&_svg]:size-7 hover:bg-mauria-purple/10 dark:hover:bg-white/10 oled:hover:bg-white/10";
const DANGER = "group w-full justify-start gap-3 px-0 h-10 [&_svg]:size-7 text-red-500 oled:text-gray-200 hover:bg-mauria-purple/10 dark:hover:bg-white/10 oled:hover:bg-white/10";
const TRAILING = "justify-end flex-1 flex pr-2 text-muted-foreground transition-colors group-hover:text-accent-foreground";
const TRAILING_DANGER = "justify-end flex-1 flex pr-2 text-red-500 oled:text-gray-300 transition-colors group-hover:text-accent-foreground oled:group-hover:text-gray-100";

type Row = { icon: LucideIcon; label: string; to?: string; url?: string; beta?: boolean; danger?: boolean };

const ROWS: Row[] = [
    { icon: Settings, label: "sidebar.actions.settings", to: "/settings" },
    { icon: HeartHandshake, label: "sidebar.actions.associations", to: "/associations" },
    { icon: FileText, label: "sidebar.actions.documents", to: "/documents", beta: true },
    { icon: Printer, label: "sidebar.actions.print", to: "/print" },
    { icon: Radar, label: "sidebar.actions.palantir", to: "/palantir", beta: true },
    { icon: ThumbsDown, label: "sidebar.actions.aurion", url: aurionURL },
    { icon: Book, label: "sidebar.actions.juniaLearning", url: juniaLearningURL },
    { icon: MailQuestionMark, label: "sidebar.help", url: contactURL },
    { icon: BadgeX, label: "sidebar.logOut", danger: true },
];

export default function Sidebar() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { setTheme } = useTheme();
    const { data: updates } = useQuery(updatesQueryOptions());
    const appVersion = updates?.[0]?.version ?? "?";

    useEffect(() => {
        applyScale(readInitialSize());
        applyLocale(readInitialLocale());
    }, []);

    const navigate = useNavigate();

    const handleNavigate = (path: string) => {
        setOpen(false);
        navigate(path);
    };

    const preload = (path: string) => () => preloadRoute(path);

    const signOut = () => {
        setTheme("light");
        clearLogoutState();
        handleNavigate("/login");
    };

    const renderRow = ({ icon: Icon, label, to, url, beta, danger }: Row) => (
        <Button
            key={label}
            variant="ghost"
            size="sm"
            className={danger ? DANGER : ROW}
            onClick={danger ? signOut : to ? () => handleNavigate(to) : () => window.open(url, "_blank")}
            onPointerEnter={to ? preload(to) : undefined}
            onPointerDown={to ? preload(to) : undefined}
            onFocus={to ? preload(to) : undefined}
        >
            <Icon className="h-5 w-5" />
            {beta ? (
                <span className="inline-flex items-center gap-1.5">
                    {t(label)}
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-semibold">
                        {"Beta"}
                    </Badge>
                </span>
            ) : (
                t(label)
            )}
            <div className={danger ? TRAILING_DANGER : TRAILING}>
                <ArrowDownRightFromSquare className="size-4!" />
            </div>
        </Button>
    );

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white [&_svg]:size-7! hover:bg-white/15 hover:text-white">
                    <Menu />
                    <span className="sr-only">{t("sidebar.openMenu")}</span>
                </Button>
            </SheetTrigger>

            <SheetContent
                side="right"
                closeLabel={t("common.close")}
                className="w-[85%] sm:max-w-sm flex flex-col gap-2 border-none oled:bg-black px-5 pb-5 pt-[var(--sidebar-safe-area-top)]"
                style={
                    {
                        "--sidebar-safe-area-top": "calc(var(--safe-area-top) + 12px)",
                        "--sheet-close-top": "calc(var(--safe-area-top) + 14px)",
                        "--sheet-close-right": "24px",
                    } as CSSProperties
                }
            >
                <SheetHeader className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]">
                    <SheetTitle>{t("sidebar.title")}</SheetTitle>
                    <div className="mt-4 space-y-4">
                        {ROWS.slice(0, 5).map(renderRow)}
                        <Separator />
                        {ROWS.slice(5, 7).map(renderRow)}
                    </div>
                </SheetHeader>

                <SheetFooter className="relative z-10 shrink-0 flex-col! gap-2 bg-background px-0 oled:bg-black">
                    <div className="w-full mt-4 space-y-4">{ROWS.slice(7).map(renderRow)}</div>

                    <Separator />

                    <p className="mt-4 text-center text-xs text-muted-foreground">
                        {t("sidebar.credits", {
                            names: "Milo Montuori, Louis Lecouturier et Louis Soltysiak",
                        })}
                    </p>
                    <div className="w-full text-center text-xs text-muted-foreground">
                        <button
                            onClick={() => handleNavigate("/versions")}
                            onPointerEnter={preload("/versions")}
                            onPointerDown={preload("/versions")}
                            onFocus={preload("/versions")}
                            className="underline underline-offset-4"
                        >
                            {"Version "}{appVersion}
                        </button>
                        <span className="mx-1">{"—"}</span>
                        <a href={githubURL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                            {t("sidebar.contribute")}
                        </a>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
