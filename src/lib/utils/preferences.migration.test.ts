/**
 * Preference storage: campus, scale, reveal mode, restaurant menu, palantir.
 *
 * Each of these is a `createStorageState` wrapper - read, write, and a React
 * hook over the same key. The behaviour worth pinning is the migration and the
 * default: two of them read a legacy key that earlier versions wrote, and all of
 * them must fall back to a sane value for a value they do not recognise rather
 * than trusting whatever is in storage.
 *
 * `getFromStorage` caches, so every test clears the cache before seeding
 * localStorage directly.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { CAMPUS_STORAGE_KEY, readCampus, setCampus } from "@/lib/utils/campus";
import { applyScale, getClosestSizeOption, readInitialSize, SCALE_STORAGE_KEY } from "@/lib/utils/scale";
import {
    GRADE_REVEAL_MODE_STORAGE_KEY,
    readGradeRevealMode,
    readPalantirTheme,
    setGradeRevealMode,
    setPalantirTheme,
    PALANTIR_THEME_STORAGE_KEY,
} from "@/lib/utils/experimental";
import { readRestaurantMenuEnabled, RESTAURANT_MENU_STORAGE_KEY } from "@/lib/utils/restaurant-menu";
import { clearStorage } from "@/lib/utils/storage";

const seed = (key: string, value: string) => {
    clearStorage();
    localStorage.setItem(key, value);
};

beforeEach(() => {
    clearStorage();
    // `applyScale` writes an inline CSS var on <html>, which jsdom keeps for the
    // whole file. Reset it or a later test inherits the previous test's scale.
    document.documentElement.style.removeProperty("--mauria-scale");
});

describe("campus", () => {
    it("defaults to Lille with nothing stored", () => {
        expect(readCampus()).toBe("lille");
    });

    it("round-trips a supported campus", () => {
        setCampus("bordeaux");
        expect(readCampus()).toBe("bordeaux");
        expect(localStorage.getItem(CAMPUS_STORAGE_KEY)).toBe("bordeaux");
    });

    it("falls back to Lille for an unrecognised stored value", () => {
        seed(CAMPUS_STORAGE_KEY, "atlantis");
        expect(readCampus()).toBe("lille");
    });

    it("migrates a legacy campus stored in the restaurant-menu key", () => {
        // Older builds wrote the campus itself into the restaurant-menu key.
        seed("mauria-restaurant-menu", "chateauroux");
        expect(readCampus()).toBe("chateauroux");
    });

    it("does not read a boolean legacy flag as a campus", () => {
        seed("mauria-restaurant-menu", "true");
        expect(readCampus()).toBe("lille");
    });
});

describe("scale", () => {
    it("maps a stored scale onto the nearest size option", () => {
        expect(getClosestSizeOption(0.7)).toBe("petit");
        expect(getClosestSizeOption(0.85)).toBe("moyen");
        expect(getClosestSizeOption(1)).toBe("grand");
    });

    it("snaps an in-between scale to the nearer option", () => {
        // 0.8 is 0.10 from petit, 0.05 from moyen -> moyen.
        expect(getClosestSizeOption(0.8)).toBe("moyen");
        // 0.9 is 0.05 from moyen, 0.10 from grand -> moyen.
        expect(getClosestSizeOption(0.9)).toBe("moyen");
        // 0.95 is 0.10 from moyen, 0.05 from grand -> grand.
        expect(getClosestSizeOption(0.95)).toBe("grand");
    });

    it("defaults to grand with nothing stored", () => {
        expect(readInitialSize()).toBe("grand");
    });

    it("reads back a scale it wrote", () => {
        applyScale("petit");
        expect(localStorage.getItem(SCALE_STORAGE_KEY)).toBe("0.7");
        expect(document.documentElement.style.getPropertyValue("--mauria-scale")).toBe("0.7");
        expect(readInitialSize()).toBe("petit");
    });

    it("ignores a non-numeric stored scale and falls through to the CSS var", () => {
        // jsdom has no --mauria-scale, so the computed value is empty, the
        // parse yields NaN, and the fallback is grand.
        seed(SCALE_STORAGE_KEY, "huge");
        expect(readInitialSize()).toBe("grand");
    });

    it("prefers the stored scale over the CSS var", () => {
        document.documentElement.style.setProperty("--mauria-scale", "1");
        seed(SCALE_STORAGE_KEY, "0.7");
        expect(readInitialSize()).toBe("petit");
    });
});

describe("grade reveal mode", () => {
    it("defaults to off", () => {
        expect(readGradeRevealMode()).toBe("off");
    });

    it("round-trips a supported mode", () => {
        setGradeRevealMode("pokemon");
        expect(readGradeRevealMode()).toBe("pokemon");
        expect(localStorage.getItem(GRADE_REVEAL_MODE_STORAGE_KEY)).toBe("pokemon");
    });

    it("migrates the legacy CS2 gambling flag", () => {
        seed("mauria-cs2-grades-gambling", "true");
        expect(readGradeRevealMode()).toBe("cs2");
    });

    it("does not migrate a false legacy flag", () => {
        seed("mauria-cs2-grades-gambling", "false");
        expect(readGradeRevealMode()).toBe("off");
    });

    it("falls back to off for an unknown stored mode", () => {
        seed(GRADE_REVEAL_MODE_STORAGE_KEY, "roulette");
        expect(readGradeRevealMode()).toBe("off");
    });

    it("clears the legacy key once a mode is chosen", () => {
        seed("mauria-cs2-grades-gambling", "true");
        setGradeRevealMode("slots");
        expect(localStorage.getItem("mauria-cs2-grades-gambling")).toBeNull();
    });
});

describe("restaurant menu flag", () => {
    it("defaults to enabled", () => {
        expect(readRestaurantMenuEnabled()).toBe(true);
    });

    it("treats the legacy 'none' value as disabled", () => {
        seed(RESTAURANT_MENU_STORAGE_KEY, "none");
        expect(readRestaurantMenuEnabled()).toBe(false);
    });

    it("treats an explicit 'false' as disabled", () => {
        seed(RESTAURANT_MENU_STORAGE_KEY, "false");
        expect(readRestaurantMenuEnabled()).toBe(false);
    });

    it("treats any other value as enabled", () => {
        seed(RESTAURANT_MENU_STORAGE_KEY, "true");
        expect(readRestaurantMenuEnabled()).toBe(true);
    });
});

describe("palantir theme", () => {
    it("defaults to off and round-trips", () => {
        expect(readPalantirTheme()).toBe(false);
        setPalantirTheme(true);
        expect(readPalantirTheme()).toBe(true);
        expect(localStorage.getItem(PALANTIR_THEME_STORAGE_KEY)).toBe("true");
    });
});
