/**
 * abbreviateSubjects — gendered and plural forms of subject adjectives.
 *
 * The published regexes anchored the start of a word but not the end, so
 * `anglais` matched inside "Anglaise" and left a stranded `e`
 * ("Civilisation Angl.e"). Adding a trailing `(?!\p{L})` guard to every
 * pattern stopped the corruption, but for the three patterns that have no
 * built-in inflection (`anglais`, `espagnol`, `allemand`) it also stopped
 * abbreviating altogether — "Civilisation Anglaise" came out untouched.
 *
 * Ending a subject is common in French ("Anglais", "Anglaise", "Anglaises"),
 * so these three patterns need explicit optional endings rather than a bare
 * stem. The guard must still hold: a near-miss word such as "Anglophone" or
 * "Espagnolette" must not be abbreviated.
 */
import { describe, expect, it } from "vitest";
import { abbreviateSubjects } from "@/lib/utils/home";

describe("gendered forms", () => {
    it.each([
        ["Anglais", "Angl."],
        ["Anglaise", "Angl."],
        ["Anglaises", "Angl."],
        ["Espagnol", "Esp."],
        ["Espagnole", "Esp."],
        ["Espagnoles", "Esp."],
        ["Allemand", "All."],
        ["Allemande", "All."],
        ["Allemandes", "All."],
    ])("abbreviates %s", (input, expected) => {
        expect(abbreviateSubjects(input)).toBe(expected);
    });

    it("abbreviates the adjective inside a longer subject", () => {
        expect(abbreviateSubjects("Civilisation Anglaise")).toBe("Civilisation Angl.");
        expect(abbreviateSubjects("Histoire Anglaise Contemporaine")).toBe("Histoire Angl. Contemporaine");
        expect(abbreviateSubjects("Civilisation Espagnole")).toBe("Civilisation Esp.");
        expect(abbreviateSubjects("Culture Allemande")).toBe("Culture All.");
    });

    it("keeps a following word intact", () => {
        expect(abbreviateSubjects("Anglais des affaires")).toBe("Angl. des affaires");
    });
});

describe("near-miss words are not abbreviated", () => {
    it.each(["Anglophone", "Anglicisme", "Espagnolette", "Allemandement", "Informatiquement"])(
        "leaves %s alone",
        (input) => {
            expect(abbreviateSubjects(input)).toBe(input);
        }
    );
});
