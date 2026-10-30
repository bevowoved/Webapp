"use client";

import { pushWidgetTheme } from "@/lib/native/widget";
import { getFromStorage, saveToStorage } from "@/lib/utils/storage";
import type React from "react";

import { createContext, use, useEffect, useState } from "react";

type Theme = "dark" | "light" | "oled" | "cherry" | "pride" | "ocean" | "forest";

type ThemeProviderProps = {
    children: React.ReactNode;
};

const ThemeProviderContext = createContext<{
    theme: Theme;
    setTheme: (theme: Theme) => void;
}>({
    theme: "dark",
    setTheme: () => null,
});

export function ThemeProvider({ children }: Readonly<ThemeProviderProps>) {
    const [theme, setTheme] = useState<Theme>(
        (getFromStorage("theme") as Theme) || "light"
    );

    useEffect(() => {
        const root = globalThis.document.documentElement;
        root.classList.remove(
            "light",
            "dark",
            "oled",
            "cherry",
            "pride",
            "ocean",
            "forest"
        );
        root.classList.add(theme);
        saveToStorage("theme", theme);
        void pushWidgetTheme(theme);
    }, [theme]);

    return (
        <ThemeProviderContext value={{ theme, setTheme }}>
            {children}
        </ThemeProviderContext>
    );
}

export const useTheme = () => {
    const context = use(ThemeProviderContext);
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
