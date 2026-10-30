import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "./src"),
        },
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
