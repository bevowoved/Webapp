"use client";

import { useState } from "react";
import { CodeXml, Eye } from "lucide-react";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
    DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { fetchUpdates } from "@/lib/api/helper";
import { useQuery } from "@tanstack/react-query";
import { UpdatesEntry } from "@/types/data";
import { getFromStorage, saveToStorage } from "@/lib/utils/storage";
import { useTranslation } from "react-i18next";

const LAST_SEEN_UPDATE_KEY = "lastSeenUpdate";

const splitContent = (content: string): string[] => {
    if (!content) return [];
    return content
        .replace(/^-+\s*/, "")
        .split(" - ")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
};

const formatUpdateContentList = (content: string): string[] =>
    splitContent(content);

export function UpdateDrawer({
    update,
    open,
    onOpenChange,
}: {
    update: UpdatesEntry;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation();
    const visual = formatUpdateContentList(update.contentVisu ?? "");
    const technical = formatUpdateContentList(update.contentDev ?? "");

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="p-0 pb-safe max-h-[85vh] flex flex-col overflow-hidden">
                <div className="sticky top-0 z-10 bg-background/95 supports-backdrop-filter:bg-background/60 border-b">
                    <DrawerHeader className="px-6 pt-6 pb-3 items-center text-center">
                        <DrawerTitle className="flex items-center justify-center gap-2">
                            {t("update.somethingNew")}
                        </DrawerTitle>
                        <div className="mb-3 flex flex-col items-center gap-3 text-sm text-muted-foreground">
                            <p>
                                {t("update.seeEnhancements")} {update.version}
                            </p>
                            <Badge variant="secondary">{update.date}</Badge>
                        </div>
                    </DrawerHeader>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 touch-pan-y [-webkit-overflow-scrolling:touch]">
                    <Alert className="mb-4">
                        <Eye className="h-4 w-4" />
                        <AlertTitle>
                            {t("update.visualImprovements")}
                        </AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 text-sm mb-4">
                                {visual.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert className="mb-4">
                        <CodeXml className="h-4 w-4" />
                        <AlertTitle>
                            {t("update.technicalImprovements")}
                        </AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 text-sm mb-4">
                                {technical.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                </div>

                <DrawerFooter className="px-6 pb-safe-offset-6 border-t">
                    <DrawerClose asChild>
                        <Button>{t("update.discardButton")}</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

export default function NewUpdateDrawer() {
    const [dismissed, setDismissed] = useState<string | null>(null);

    const { data: updates } = useQuery({
        queryKey: ["updates"],
        queryFn: fetchUpdates,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnMount: true,
    });

    const update = updates?.[0] ?? null;
    const version = update?.version ?? null;
    const seen = getFromStorage(LAST_SEEN_UPDATE_KEY);
    const open = Boolean(version) && seen !== version && dismissed !== version;

    if (update === null) return null;

    return (
        <UpdateDrawer
            update={update}
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    if (version) saveToStorage(LAST_SEEN_UPDATE_KEY, version);
                    setDismissed(version);
                }
            }}
        />
    );
}
