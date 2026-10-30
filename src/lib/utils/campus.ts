import { createStorageState, getFromStorage } from "./storage";

export const CAMPUS_STORAGE_KEY = "mauria-campus";

const CAMPUS_EVENT = "mauria-campus-change";

export type Campus = "lille" | "chateauroux" | "bordeaux";

export const CAMPUS_OPTIONS: Campus[] = ["lille", "chateauroux", "bordeaux"];
export const RESTAURANT_CAMPUSES: Campus[] = ["lille", "chateauroux"];
export const WIFI_CAMPUS: Campus = "lille";
export const FREE_ROOMS_CAMPUSES: Campus[] = ["lille", "bordeaux"];

const LEGACY_RESTAURANT_MENU_KEY = "mauria-restaurant-menu";

const normalize = (raw: string | null): Campus => (raw === "chateauroux" || raw === "bordeaux" ? raw : "lille");

const state = createStorageState<Campus>(
    CAMPUS_STORAGE_KEY,
    CAMPUS_EVENT,
    (raw) => normalize(raw ?? getFromStorage(LEGACY_RESTAURANT_MENU_KEY)),
    (campus) => campus
);

export const readCampus = state.read;

export const setCampus = state.write;

export const useCampus = (): Campus => state.useValue("lille");
