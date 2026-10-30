import { Loader2, ServerCrash, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AurionDownState({ message }: { message: string }) {
    const { t } = useTranslation();

    return (
        <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ServerCrash className="w-8 h-8 text-red-500 dark:text-red-300 oled:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
                {t("homePage.aurionDownTitle")}
            </h3>
            <p className="text-muted-foreground">{message}</p>
        </>
    );
}

export function EmptyListState({
    busy,
    aurionDown,
    hasCachedItems,
    cachedMessage,
    icon: Icon,
    emptyTitle,
    emptyBody,
    loadingHint,
}: {
    busy: boolean;
    aurionDown: boolean;
    hasCachedItems: boolean;
    cachedMessage: string;
    icon: LucideIcon;
    emptyTitle: string;
    emptyBody: string;
    loadingHint?: string;
}) {
    const { t } = useTranslation();

    return (
        <div className="text-center py-12">
            <div className="bg-mauria-card rounded-xl shadow-md p-8 max-w-md mx-auto">
                {aurionDown && !hasCachedItems ? (
                    <AurionDownState message={cachedMessage} />
                ) : (
                    <>
                        <div className="w-16 h-16 bg-muted-foreground/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            {busy ? (
                                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                            ) : (
                                <Icon className="w-8 h-8 text-muted-foreground" />
                            )}
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                            {busy ? t("common.loading") : emptyTitle}
                        </h3>
                        {busy && loadingHint && (
                            <p className="text-xs text-muted-foreground">{loadingHint}</p>
                        )}
                        {!busy && <p className="text-muted-foreground">{emptyBody}</p>}
                    </>
                )}
            </div>
        </div>
    );
}

