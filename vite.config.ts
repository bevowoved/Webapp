import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";

const COMPRESS_WORKER = `
const { parentPort } = require("node:worker_threads");
const { readFileSync, writeFileSync } = require("node:fs");
const { constants, brotliCompressSync, gzipSync } = require("node:zlib");

parentPort.on("message", ({ file, minBytes }) => {
    try {
        const source = readFileSync(file);
        if (source.byteLength < minBytes) {
            parentPort.postMessage({ file, raw: 0, br: 0, gz: 0 });
            return;
        }
        const brotli = brotliCompressSync(source, {
            params: {
                [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
                [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
                [constants.BROTLI_PARAM_SIZE_HINT]: source.byteLength,
            },
        });
        const gzip = gzipSync(source, { level: constants.Z_BEST_COMPRESSION });
        writeFileSync(file + ".br", brotli);
        writeFileSync(file + ".gz", gzip);
        parentPort.postMessage({ file, raw: source.byteLength, br: brotli.byteLength, gz: gzip.byteLength });
    } catch (error) {
        parentPort.postMessage({ file, error: String(error) });
    }
});
`;

type CompressResult = { file: string; raw: number; br: number; gz: number };

async function collectCompressible(dir: string, extensions: readonly string[]): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const found = await Promise.all(
        entries.map(async (entry) => {
            const full = resolve(dir, entry.name);
            if (entry.isDirectory()) return collectCompressible(full, extensions);
            return entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
        })
    );
    return found.flat();
}

function precompress(options: { extensions: readonly string[]; minBytes: number }): Plugin {
    const { extensions, minBytes } = options;

    return {
        name: "mauria:precompress",
        apply: "build",
        enforce: "post",
        async writeBundle(outputOptions, bundle) {
            const outDir = outputOptions.dir;
            if (!outDir) return;

            const swFile = resolve(outDir, "sw.js");
            const swSource = await readFile(swFile, "utf8").catch(() => "");
            if (swSource.includes("__BUILD_HASH__")) {
                const hash = createHash("sha256")
                    .update(
                        Object.keys(bundle)
                            .filter((key) => /\.(?:js|css)$/.test(key))
                            .sort()
                            .join("\n")
                    )
                    .digest("hex")
                    .slice(0, 12);
                await writeFile(swFile, swSource.replaceAll("__BUILD_HASH__", hash));
                this.info(`service worker stamped: mauria-${hash}`);
            }

            const files = await collectCompressible(outDir, extensions);
            const sizes = await Promise.all(
                files.map(async (file) => ({ file, size: (await stat(file)).size }))
            );
            const targets = sizes.filter(({ size }) => size >= minBytes).map(({ file }) => file);
            if (targets.length === 0) return;

            const poolSize = Math.min(targets.length, Math.max(1, availableParallelism() - 1));
            const queue = [...targets];
            const results: CompressResult[] = [];

            await Promise.all(
                Array.from({ length: poolSize }, () =>
                    new Promise<void>((done, fail) => {
                        const worker = new Worker(COMPRESS_WORKER, { eval: true });

                        const feed = () => {
                            const next = queue.pop();
                            if (next === undefined) {
                                void worker.terminate();
                                done();
                                return;
                            }
                            worker.postMessage({ file: next, minBytes });
                        };

                        worker.on("message", (result: CompressResult & { error?: string }) => {
                            if (result.error) {
                                void worker.terminate();
                                fail(new Error(`precompress ${result.file}: ${result.error}`));
                                return;
                            }
                            results.push(result);
                            feed();
                        });
                        worker.on("error", fail);
                        feed();
                    })
                )
            );

            const raw = results.reduce((sum, r) => sum + r.raw, 0);
            if (raw === 0) return;
            const br = results.reduce((sum, r) => sum + r.br, 0);
            const gz = results.reduce((sum, r) => sum + r.gz, 0);
            const pct = (compressed: number) => ((1 - compressed / raw) * 100).toFixed(1);

            this.info(
                `precompress: ${results.length} files, ${poolSize} workers | ` +
                    `raw ${(raw / 1024).toFixed(1)} kB -> ` +
                    `br ${(br / 1024).toFixed(1)} kB (-${pct(br)}%) | ` +
                    `gz ${(gz / 1024).toFixed(1)} kB (-${pct(gz)}%)`
            );
        },
    };
}

export default defineConfig(() => {
    const basePath = process.env.VITE_BASE_PATH ?? "/";

    return {
        base: basePath,
        plugins: [
            react(),
            precompress({
                extensions: [".js", ".mjs", ".css", ".html", ".svg", ".webmanifest", ".json", ".txt", ".xml"],
                minBytes: 256,
            }),
        ],
        resolve: {
            alias: {
                "@": resolve(import.meta.dirname, "./src"),
            },
        },
        build: {
            outDir: "dist",
            target: "es2024",
            rolldownOptions: {
                output: {
                    comments: { legal: false, annotation: true, jsdoc: false },
                    codeSplitting: {
                        minSize: 2_000,
                        groups: [
                            {
                                name: "vendor-core",
                                test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler|@tanstack|react-router|framer-motion|motion-dom|motion-utils)[\\/]/,
                                priority: 20,
                            },
                        ],
                    },
                    entryFileNames: "assets/[name]-[hash].js",
                    chunkFileNames: "assets/[name]-[hash].js",
                    assetFileNames: "assets/[name]-[hash][extname]",
                },
            },
        },
    };
});
