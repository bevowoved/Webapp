import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

/**
 * Vitest stubs CSS imports (both `?raw` and `?inline` resolve to an empty
 * string), so a test cannot read a stylesheet through the module graph. The
 * reduced-motion regression test needs the real source text to assert that the
 * global `@media (prefers-reduced-motion: reduce)` block exists and is
 * exhaustive. Inlining it as a define keeps the test honest: it reads exactly
 * the file that ships, not a copy.
 */
const cssSource = (relativePath: string): string =>
    JSON.stringify(readFileSync(resolve(import.meta.dirname, relativePath), "utf8"));

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "./src"),
        },
    },
    define: {
        __GLOBALS_CSS__: cssSource("./src/styles/globals.css"),
        __PLANNING_CSS__: cssSource("./src/styles/planning-calendar.css"),
        __PALANTIR_CSS__: cssSource("./src/pages/palantir/palantir-theme.css"),
    },
    test: {
        environment: "jsdom",
        globals: false,
        include: ["src/**/*.test.{ts,tsx}"],
        setupFiles: ["src/test-setup.ts"],
        // Pin the timezone so date tests are deterministic on any CI machine.
        // The app ships to French users, so Europe/Paris is the honest default.
        env: { TZ: "Europe/Paris" },
        restoreMocks: true,
        clearMocks: true,
        reporters: ["default"],
        testTimeout: 10_000,
    },
});
