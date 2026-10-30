import { beforeAll } from "vitest";
import i18n from "@/i18n";

/**
 * i18n's `init()` is asynchronous. Components rendered before it resolves see
 * empty translation strings, which makes text-based queries fail for reasons
 * unrelated to what is being tested. Await it once before any test runs.
 */
beforeAll(async () => {
    if (!i18n.isInitialized) {
        await new Promise<void>((resolve) => {
            i18n.on("initialized", () => resolve());
        });
    }
    await i18n.changeLanguage("fr");
});
