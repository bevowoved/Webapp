/**
 * findmyroom.ts - turning Aurion room codes into something readable.
 *
 * The free-rooms page shows a building name, a room name and a one-line status
 * ("Libre jusqu'à 14h00"). All three come out of this module, and all three are
 * pure string transforms over codes like `IC2_C401_VP`. A regression shows the
 * user a raw code or a mangled time.
 */
import { describe, expect, it } from "vitest";
import {
    computeBookableUntil,
    formatBuildingName,
    formatRoomName,
    formatTimeOfDay,
    getCommonPrefixTokenCount,
    isBuildingOnCampus,
    isRedundantAllDayDuration,
    splitHighlight,
    stripRedundantFreeLabel,
} from "@/lib/utils/findmyroom";

describe("formatBuildingName", () => {
    it("uses the known display name for a mapped code", () => {
        expect(formatBuildingName("ALG_2RNS")).toBe("Albert Legrand");
        expect(formatBuildingName("PR_39BV")).toBe("Palais Rameau");
    });

    it("title-cases the tokens of an unmapped code", () => {
        expect(formatBuildingName("XYZ_ABC")).toBe("XYZ ABC");
    });
});

describe("isBuildingOnCampus", () => {
    it("maps a known building to its campus", () => {
        expect(isBuildingOnCampus("BORDEAUX_2AML", "bordeaux")).toBe(true);
        expect(isBuildingOnCampus("IC1", "lille")).toBe(true);
    });

    it("defaults an unknown building to Lille", () => {
        expect(isBuildingOnCampus("UNKNOWN", "lille")).toBe(true);
        expect(isBuildingOnCampus("UNKNOWN", "bordeaux")).toBe(false);
    });
});

describe("getCommonPrefixTokenCount", () => {
    it("counts the tokens every room shares, never the last one", () => {
        expect(getCommonPrefixTokenCount(["IC2_C401", "IC2_C402", "IC2_A812"])).toBe(1);
    });

    it("returns 0 with no shared prefix", () => {
        expect(getCommonPrefixTokenCount(["A_B", "C_D"])).toBe(0);
    });

    it("returns 0 for an empty list", () => {
        expect(getCommonPrefixTokenCount([])).toBe(0);
    });
});

describe("formatRoomName", () => {
    it("drops the requested number of leading tokens", () => {
        expect(formatRoomName("IC2_C401", 1)).toBe("C401");
        expect(formatRoomName("IC2_C401", 2)).toBe("IC2 C401");
    });

    it("keeps the whole code when every token would be dropped", () => {
        expect(formatRoomName("IC2_C401", 9)).toBe("IC2 C401");
    });

    it("renders a known tag in parentheses", () => {
        expect(formatRoomName("IC2_C401_VP", 2)).toBe("(Vidéo proj.)");
    });
});

describe("splitHighlight", () => {
    it("highlights an all-day phrase before anything else", () => {
        expect(splitHighlight("toute la journée", false)?.highlight).toBe("toute la journée");
    });

    it("highlights a duration", () => {
        expect(splitHighlight("Libre 2h max", false)).toEqual({ prefix: "Libre ", highlight: "2h max", suffix: "" });
    });

    it("renders a time in French or English form", () => {
        expect(splitHighlight("Libre jusqu'à 14:00", false)?.highlight).toBe("14h00");
        expect(splitHighlight("Libre jusqu'à 14:00", true)?.highlight).toBe("14:00");
    });

    it("returns null when there is nothing to highlight", () => {
        expect(splitHighlight("no time here", false)).toBeNull();
    });
});

describe("formatTimeOfDay", () => {
    it("uses h in French and a colon in English", () => {
        expect(formatTimeOfDay("14:05", false)).toBe("14h05");
        expect(formatTimeOfDay("14:05", true)).toBe("14:05");
    });

    it("returns the input unchanged when it is not a time", () => {
        expect(formatTimeOfDay("bad", false)).toBe("bad");
    });
});

describe("isRedundantAllDayDuration", () => {
    it("is true for an all-day phrase", () => {
        expect(isRedundantAllDayDuration("toute la journée")).toBe(true);
    });

    it("is false for a normal time", () => {
        expect(isRedundantAllDayDuration("14:00")).toBe(false);
    });
});

describe("stripRedundantFreeLabel", () => {
    it("drops the leading free label when the room is free", () => {
        expect(stripRedundantFreeLabel("Libre jusqu'à 14:00", true)).toBe("jusqu'à 14:00");
    });

    it("leaves the text alone when the room is not free", () => {
        expect(stripRedundantFreeLabel("Libre jusqu'à 14:00", false)).toBe("Libre jusqu'à 14:00");
    });
});

describe("computeBookableUntil", () => {
    it("adds the bookable duration to the free-from time", () => {
        expect(computeBookableUntil("Libre jusqu'à 14:00", "réservable ensuite : 2h max", false)).toBe("16h00");
    });

    it("wraps past midnight", () => {
        expect(computeBookableUntil("Libre jusqu'à 23:30", "réservable ensuite : 1h max", false)).toBe("00h30");
    });

    it("returns null when the duration is not stated", () => {
        expect(computeBookableUntil("Libre jusqu'à 14:00", "nothing", false)).toBeNull();
    });

    it("returns null when the time is not stated", () => {
        expect(computeBookableUntil("no time", "réservable ensuite : 2h max", false)).toBeNull();
    });

    it("formats in English when asked", () => {
        expect(computeBookableUntil("Libre jusqu'à 14:00", "réservable ensuite : 2h max", true)).toBe("16:00");
    });
});
