"use client";

import { getFromStorage, saveToStorage } from "@/lib/utils/storage";
import type React from "react";
import { createContext, use, useState } from "react";

const BACKGROUND_STORAGE_KEY = "background";

const BACKGROUND_OPTIONS = [
    "particles",
    "grid",
    "topography",
    "dot-pattern",
] as const;

export type BackgroundName = (typeof BACKGROUND_OPTIONS)[number];

type BackgroundProviderProps = {
    children: React.ReactNode;
    defaultBackground?: BackgroundName;
};

type BackgroundContextValue = {
    background: BackgroundName;
    setBackground: (background: string) => void;
    options: typeof BACKGROUND_OPTIONS;
};

function validateBackground(
    value: string | null,
    fallback: BackgroundName
): BackgroundName {
    if (!value) return fallback;
    return BACKGROUND_OPTIONS.includes(value as BackgroundName)
        ? (value as BackgroundName)
        : fallback;
}

const BackgroundProviderContext = createContext<BackgroundContextValue>({
    background: BACKGROUND_OPTIONS[0],
    setBackground: () => undefined,
    options: BACKGROUND_OPTIONS,
});

export function BackgroundProvider({
    children,
    defaultBackground = BACKGROUND_OPTIONS[0],
}: BackgroundProviderProps) {
    const [background, setBackgroundState] = useState<BackgroundName>(() =>
        validateBackground(
            getFromStorage(BACKGROUND_STORAGE_KEY),
            defaultBackground
        )
    );

    const setBackground = (nextBackground: string) => {
        const valid = validateBackground(nextBackground, background);
        setBackgroundState(valid);
        saveToStorage(BACKGROUND_STORAGE_KEY, valid);
    };

    return (
        <BackgroundProviderContext
            value={{ background, setBackground, options: BACKGROUND_OPTIONS }}
        >
            {children}
        </BackgroundProviderContext>
    );
}

export const useBackground = () => {
    const context = use(BackgroundProviderContext);
    if (context === undefined) {
        throw new Error(
            "useBackground must be used within a BackgroundProvider"
        );
    }
    return context;
};
