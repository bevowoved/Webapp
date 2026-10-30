import { createStorageState, getFromStorage, removeFromStorage } from "./storage";

export const GRADE_REVEAL_MODES = ["off", "cs2", "fdj", "pokemon", "slots", "overwatch"] as const;

export type GradeRevealMode = (typeof GRADE_REVEAL_MODES)[number];

export const GRADE_REVEAL_MODE_STORAGE_KEY = "mauria-grade-reveal-mode";

const CS2_GRADES_GAMBLING_STORAGE_KEY = "mauria-cs2-grades-gambling";

const GRADE_REVEAL_MODE_EVENT = "mauria-grade-reveal-mode-change";

const isGradeRevealMode = (value: unknown): value is GradeRevealMode => GRADE_REVEAL_MODES.includes(value as GradeRevealMode);

const modeState = createStorageState<GradeRevealMode>(
    GRADE_REVEAL_MODE_STORAGE_KEY,
    GRADE_REVEAL_MODE_EVENT,
    (raw) => (isGradeRevealMode(raw) ? raw : getFromStorage(CS2_GRADES_GAMBLING_STORAGE_KEY) === "true" ? "cs2" : "off"),
    (mode) => mode
);

export const readGradeRevealMode = modeState.read;

export const setGradeRevealMode = (mode: GradeRevealMode) => {
    removeFromStorage(CS2_GRADES_GAMBLING_STORAGE_KEY);
    modeState.write(mode);
};

export const useGradeRevealMode = (): GradeRevealMode => modeState.useValue("off");

export const PALANTIR_THEME_STORAGE_KEY = "mauria-palantir-void";

const PALANTIR_THEME_EVENT = "mauria-palantir-theme-change";

const palantirState = createStorageState<boolean>(PALANTIR_THEME_STORAGE_KEY, PALANTIR_THEME_EVENT, (raw) => raw === "true", (v) => String(v));

export const readPalantirTheme = palantirState.read;

export const setPalantirTheme = palantirState.write;

export const usePalantirTheme = (): boolean => palantirState.useValue(false);
