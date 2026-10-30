"use client";

import { cn } from "@/lib/utils/cn";
import React, { useEffect, useRef } from "react";

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2 = new Float32Array([
    1, 1, -1, 1, 1, -1, -1, -1,
    1, 0, -1, 0, 1, 0, -1, 0,
    0, 1, 0, -1, 0, 1, 0, -1,
]);

const PERM = (() => {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) p[i] = i;
    let seed = 1337;
    for (let i = 255; i > 0; i -= 1) {
        seed = (seed * 16807) % 2147483647;
        const j = seed % (i + 1);
        const tmp = p[i]!;
        p[i] = p[j]!;
        p[j] = tmp;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255]!;
    return perm;
})();

function createNoise2D(): (x: number, y: number) => number {
    return (x: number, y: number): number => {
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const x0 = x - (i - t);
        const y0 = y - (j - t);
        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;
        const ii = i & 255;
        const jj = j & 255;

        let n = 0;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 > 0) {
            const gi = (PERM[ii + PERM[jj]!]! % 12) * 2;
            t0 *= t0;
            n += t0 * t0 * (GRAD2[gi]! * x0 + GRAD2[gi + 1]! * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 > 0) {
            const gi = (PERM[ii + i1 + PERM[jj + j1]!]! % 12) * 2;
            t1 *= t1;
            n += t1 * t1 * (GRAD2[gi]! * x1 + GRAD2[gi + 1]! * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 > 0) {
            const gi = (PERM[ii + 1 + PERM[jj + 1]!]! % 12) * 2;
            t2 *= t2;
            n += t2 * t2 * (GRAD2[gi]! * x2 + GRAD2[gi + 1]! * y2);
        }

        return 70 * n;
    };
}

export interface TopographyProps {
    className?: string;
    lineCount?: number;
    speed?: number;
    amplitude?: number;
    opacity?: number;
}

const IDLE_FPS = 10;

export const Topography: React.FC<TopographyProps> = ({
    className,
    lineCount = 16,
    speed = 0.0008,
    amplitude = 22,
    opacity = 0.5,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const colorRef = useRef<string>("");
    const tRef = useRef<number>(0);
    const visibleRef = useRef<boolean>(true);
    const lastFrameRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const noise2D = createNoise2D();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const resolveColor = () => {
            const raw = getComputedStyle(document.documentElement).getPropertyValue("--mauria-border").trim();
            colorRef.current = raw ? `hsl(${raw})` : "hsl(220 13% 91%)";
        };

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round(container.offsetWidth * dpr));
            canvas.height = Math.max(1, Math.round(container.offsetHeight * dpr));
            canvas.style.width = `${container.offsetWidth}px`;
            canvas.style.height = `${container.offsetHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const render = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;
            ctx.clearRect(0, 0, width, height);
            ctx.globalAlpha = opacity;
            ctx.strokeStyle = colorRef.current;
            ctx.lineWidth = 1;

            const t = tRef.current;
            const gap = height / (lineCount + 1);

            for (let i = 1; i <= lineCount; i += 1) {
                const yBase = gap * i;
                ctx.beginPath();
                for (let x = 0; x <= width; x += 6) {
                    const n = noise2D(x * 0.002, i * 0.25 + t);
                    const y = yBase + n * amplitude;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            tRef.current += speed;
        };

        const draw = (now: number) => {
            animRef.current = requestAnimationFrame(draw);
            if (!visibleRef.current || document.hidden) return;
            if (now - lastFrameRef.current < 1000 / IDLE_FPS) return;
            lastFrameRef.current = now;
            render();
        };

        resolveColor();
        resize();
        if (reduced) render();
        else animRef.current = requestAnimationFrame(draw);

        const io = new IntersectionObserver(
            (entries) => {
                visibleRef.current = entries[0]?.isIntersecting ?? true;
            },
            { threshold: 0 }
        );
        io.observe(canvas);

        const ro = new ResizeObserver(resize);
        ro.observe(container);

        window.addEventListener("resize", resize);
        const observer = new MutationObserver(resolveColor);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animRef.current);
            io.disconnect();
            ro.disconnect();
            observer.disconnect();
            canvas.width = 0;
            canvas.height = 0;
        };
    }, [lineCount, speed, amplitude, opacity]);

    return (
        <div ref={containerRef} className={cn("pointer-events-none", className)} aria-hidden="true">
            <canvas ref={canvasRef} className="size-full" />
        </div>
    );
};
