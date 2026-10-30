"use client";

import { memo, useMemo, useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { EmptyListState } from "@/components/aurion-down-state";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { useAurionWarm } from "@/lib/hooks/use-aurion-warm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadDocument } from "@/lib/api/aurion";
import { documentsQueryOptions } from "@/lib/hooks/use-colles";
import { useQuery } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { AurionDocument, DocumentCategory } from "@/types/aurion";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { fadeIn, staggerGroup } from "@/lib/motion";
import { CarouselItem, FilterCarousel } from "@/components/filter-carousel";
import { toast } from "sonner";

const EMPTY_DOCUMENTS: AurionDocument[] = Object.freeze([]) as unknown as AurionDocument[];
const EMPTY_CATEGORIES: DocumentCategory[] = Object.freeze([]) as unknown as DocumentCategory[];

const documentId = (doc: AurionDocument) =>
    `${doc.category}-${doc.docIndex}-${doc.submitParam}`;

export function DocumentsPage() {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null
    );
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const { isWarming } = useAurionWarm();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;

    const {
        data: result,
        refetch,
        isLoading,
    } = useQuery(documentsQueryOptions(!isWarming && !aurionDown));

    const documents = result?.documents ?? EMPTY_DOCUMENTS;
    const categories = result?.categories ?? EMPTY_CATEGORIES;

    const isBusy = (isWarming && documents.length === 0) || isLoading;
    const handleRefresh = () => refetch();

    const categoryItems = useMemo<CarouselItem[]>(() => {
        if (categories.length === 0) return [];
        return [
            { value: null, label: t("documentsPage.allCategories") },
            ...categories.map((c) => ({ value: c.menuid, label: c.label })),
        ];
    }, [categories, t]);

    const categoryLabels = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of categories) map.set(c.menuid, c.label);
        return map;
    }, [categories]);

    const displayedDocuments = useMemo(() => {
        if (!selectedCategory) return documents;
        return documents.filter((d) => d.category === selectedCategory);
    }, [documents, selectedCategory]);

    const handleDownload = async (doc: AurionDocument) => {
        const id = documentId(doc);
        if (downloadingId === id) return;
        setDownloadingId(id);
        const outcome = await downloadDocument(doc);
        setDownloadingId(null);
        if (outcome.status === "saved") {
            toast.success(
                t("documentsPage.downloadSuccess", {
                    filename: outcome.filename,
                })
            );
        } else if (outcome.status === "handedOff") {
            toast.success(t("documentsPage.downloadStarted"));
        } else {
            toast.error(t("documentsPage.downloadError"));
        }
    };

    const filterKey = selectedCategory ?? "all";

    return (
        <PullToRefresh
            onRefresh={handleRefresh}
            className="space-y-4 pt-4"
            isPullable={!isBusy}
            pullingText={t("common.pullToRefresh")}
            refreshingText={t("common.refreshing")}
        >
            <motion.div
                variants={staggerGroup}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={fadeIn} className="space-y-3 mb-4">
                    {categoryItems.length > 1 && (
                        <FilterCarousel
                            items={categoryItems}
                            selected={selectedCategory}
                            onSelect={setSelectedCategory}
                        />
                    )}
                </motion.div>

                <AnimatePresence mode="popLayout">
                    {displayedDocuments.length === 0 ? (
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
                                hasCachedItems={documents.length > 0}
                                cachedMessage={t("documentsPage.noDocumentsCached")}
                                icon={FileText}
                                emptyTitle={t("documentsPage.noDocuments")}
                                emptyBody={t("documentsPage.noDocumentsPlaceholder")}
                                loadingHint={t("documentsPage.loadingHint")}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`list-${filterKey}`}
                            className="space-y-3 pb-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{
                                opacity: 0,
                                transition: { duration: 0.15 },
                            }}
                        >
                            <AnimatePresence mode="popLayout">
                                {displayedDocuments.map((doc) => {
                                    const id = documentId(doc);
                                    return (
                                        <DocumentCard
                                            key={id}
                                            doc={doc}
                                            categoryLabel={
                                                categoryLabels.get(
                                                    doc.category
                                                ) ?? doc.category
                                            }
                                            downloading={downloadingId === id}
                                            onDownload={() =>
                                                handleDownload(doc)
                                            }
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </PullToRefresh>
    );
}

const DocumentCard = memo(function DocumentCard({
    doc,
    categoryLabel,
    downloading,
    onDownload,
}: {
    doc: AurionDocument;
    categoryLabel: string;
    downloading: boolean;
    onDownload: () => void;
}) {
    return (
        <Card className="border-none bg-white shadow-md dark:bg-mauria-card overflow-hidden">
            <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">
                        {doc.label}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{categoryLabel}</span>
                        {doc.size && (
                            <>
                                <span>·</span>
                                <span className="shrink-0">{doc.size}</span>
                            </>
                        )}
                    </div>
                    {doc.type && (
                        <p className="text-xs text-muted-foreground/70 truncate">
                            {doc.type}
                        </p>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 [&_svg]:size-5"
                    onClick={onDownload}
                    disabled={downloading}
                >
                    {downloading ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <Download />
                    )}
                </Button>
            </CardContent>
        </Card>
    );
});
