interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

/**
 * Stylesheet sources inlined by vitest.config.ts. Vitest stubs CSS imports, so
 * the reduced-motion regression test reads the real files through these.
 */
declare const __GLOBALS_CSS__: string;
declare const __PLANNING_CSS__: string;
declare const __PALANTIR_CSS__: string;
