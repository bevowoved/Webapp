import i18n, { type BackendModule, type LanguageDetectorModule } from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "@/locales/fr-FR.json";
import { getFromStorage } from "@/lib/utils/storage";

const KEY = "mauria-locale";
const SUPPORTED = ["fr", "en", "es"] as const;

type Supported = (typeof SUPPORTED)[number];

const LOADERS: Partial<Record<Supported, () => Promise<{ default: object }>>> = {
    en: () => import("@/locales/en-US.json"),
    es: () => import("@/locales/es-ES.json"),
};

const normalize = (lng?: string | null): Supported => {
    const code = (lng ?? "").toLowerCase();
    return code.startsWith("en") ? "en" : code.startsWith("es") ? "es" : "fr";
};

const detector: LanguageDetectorModule = {
    type: "languageDetector",
    detect: () => {
        const stored = getFromStorage(KEY);
        if (stored) return normalize(stored);
        return typeof navigator !== "undefined" ? normalize(navigator.language) : "fr";
    },
    cacheUserLanguage: (lng) => {
        if (typeof document !== "undefined") document.documentElement.lang = normalize(lng);
    },
};

const backend: BackendModule = {
    type: "backend",
    init: () => undefined,
    read: (language, _namespace, callback) => {
        const loader = LOADERS[normalize(language)];
        if (!loader) {
            callback(null, {});
            return;
        }
        loader().then(
            (mod) => callback(null, mod.default ?? mod),
            (err) => callback(err as Error, false)
        );
    },
};

void i18n
    .use(detector)
    .use(backend)
    .use(initReactI18next)
    .init({
        fallbackLng: "fr",
        supportedLngs: [...SUPPORTED],
        partialBundledLanguages: true,
        resources: { fr: { translation: fr } },
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
    });

export default i18n;

