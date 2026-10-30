import { createStorageState } from "./storage";

export const RESTAURANT_MENU_STORAGE_KEY = "mauria-restaurant-menu";

const RESTAURANT_MENU_EVENT = "mauria-restaurant-menu-change";

const state = createStorageState<boolean>(
    RESTAURANT_MENU_STORAGE_KEY,
    RESTAURANT_MENU_EVENT,
    (raw) => raw !== "false" && raw !== "none",
    (v) => String(v)
);

export const readRestaurantMenuEnabled = state.read;

export const setRestaurantMenuEnabled = state.write;

export const useRestaurantMenuEnabled = (): boolean => state.useValue(true);
