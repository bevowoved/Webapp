"use client";

import { cn } from "@/lib/utils/cn";
import React, { useEffect, useRef } from "react";

export interface DotPatternProps {
    className?: string;
    dotSize?: number;
    gap?: number;
    glowRadius?: number;
}

const BUCKETS = 8;
const IDLE_FPS = 10;

function resolveHslToRgb(cssVarValue: string, fallback: [number, number, number]): [number, number, number] {
    if (typeof window === "undefined") return fallback;
    const el = document.createElement("span");
    el.style.color = `hsl(${cssVarValue})`;
    el.style.display = "none";
    document.body.appendChild(el);
    try {
        const match = getComputedStyle(el).color.match(/\d+/g);
        if (match) return [+match[0]!, +match[1]!, +match[2]!];
    } finally {
        el.remove();
    }
    return fallback;
}

export const DotPattern: React.FC<DotPatternProps> = ({ className, dotSize = 1.5, gap = 24, glowRadius = 100 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
    const dotsRef = useRef<Float32Array>(new Float32Array(0));
    const dotCountRef = useRef<number>(0);
    const baseRgbRef = useRef<[number, number, number]>([150, 150, 150]);
    const glowRgbRef = useRef<[number, number, number]>([255, 120, 60]);
    const tRef = useRef<number>(0);
    const lastFrameRef = useRef<number>(0);
    const lastInputRef = useRef<number>(0);
    const visibleRef = useRef<boolean>(true);
    const reducedRef = useRef<boolean>(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const resolveColors = () => {
            const style = getComputedStyle(document.documentElement);
            baseRgbRef.current = resolveHslToRgb(style.getPropertyValue("--mauria-border").trim(), [150, 150, 150]);
            glowRgbRef.current = resolveHslToRgb(style.getPropertyValue("--mauria-particles").trim(), [255, 120, 60]);
        };

        const buildDots = () => {
            const { width, height } = canvas;
            const cols = Math.floor(width / gap) + 1;
            const rows = Math.floor(height / gap) + 1;
            const total = cols * rows;
            const buf = new Float32Array(total * 3);
            let i = 0;
            for (let row = 0; row < rows; row += 1) {
                const y = row * gap;
                for (let col = 0; col < cols; col += 1) {
                    const x = col * gap;
                    buf[i] = x;
                    buf[i + 1] = y;
                    buf[i + 2] = (x / gap + y / gap) * 0.3;
                    i += 3;
                }
            }
            dotsRef.current = buf;
            dotCountRef.current = total;
        };

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = container.offsetWidth;
            const h = container.offsetHeight;
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            buildDots();
        };

        const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

        const draw = (now: number) => {
            animRef.current = requestAnimationFrame(draw);
            if (!visibleRef.current || document.hidden) return;

            const idle = now - lastInputRef.current > 400;
            const minDelta = 1000 / (idle ? IDLE_FPS : 60);
            if (now - lastFrameRef.current < minDelta) return;
            lastFrameRef.current = now;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;
            ctx.clearRect(0, 0, width, height);

            const t = tRef.current;
            const { x: mx, y: my } = mouseRef.current;
            const [br, bg, bb] = baseRgbRef.current;
            const [gr, gg, gb] = glowRgbRef.current;
            const glowSq = glowRadius * glowRadius;
            const invGlow = 1 / glowRadius;
            const buf = dotsRef.current;
            const total = dotCountRef.current;

            for (let b = 0; b < BUCKETS; b += 1) buckets[b]!.length = 0;

            for (let i = 0; i < total; i += 1) {
                const idx = i * 3;
                const x = buf[idx]!;
                const y = buf[idx + 1]!;
                const phase = buf[idx + 2]!;
                const dx = x - mx;
                const dy = y - my;
                const distSq = dx * dx + dy * dy;
                let prox = 0;
                if (distSq < glowSq) prox = 1 - Math.sqrt(distSq) * invGlow;
                const wave = (Math.sin(t * 1.5 + phase) + 1) * 0.5;
                const alpha = Math.min(1, 0.2 + wave * 0.15 + prox * 0.45);
                const bucket = Math.min(BUCKETS - 1, (alpha * (BUCKETS - 1)) | 0);
                const arr = buckets[bucket]!;
                arr.push(x, y, dotSize + prox * dotSize * 1.5);
            }

            for (let b = 0; b < BUCKETS; b += 1) {
                const arr = buckets[b]!;
                if (arr.length === 0) continue;
                const prox = b / (BUCKETS - 1);
                ctx.fillStyle = `rgba(${Math.round(br + (gr - br) * prox)}, ${Math.round(bg + (gg - bg) * prox)}, ${Math.round(bb + (gb - bb) * prox)}, ${(0.2 + prox * 0.45).toFixed(3)})`;
                ctx.beginPath();
                for (let j = 0; j < arr.length; j += 3) {
                    const s = arr[j + 2]!;
                    ctx.rect(arr[j]! - s, arr[j + 1]! - s, s * 2, s * 2);
                }
                ctx.fill();
            }

            tRef.current += 0.016;
        };

        resolveColors();
        resize();
        if (reducedRef.current) {
            lastInputRef.current = 0;
            draw(performance.now());
        } else {
            animRef.current = requestAnimationFrame(draw);
        }

        const onMouseMove = (e: MouseEvent) => {
            lastInputRef.current = performance.now();
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            mouseRef.current = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : { x: -9999, y: -9999 };
        };

        const io = new IntersectionObserver(
            (entries) => {
                visibleRef.current = entries[0]?.isIntersecting ?? true;
            },
            { threshold: 0 }
        );
        io.observe(canvas);

        window.addEventListener("mousemove", onMouseMove, { passive: true });
        window.addEventListener("resize", resize);

        const observer = new MutationObserver(resolveColors);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animRef.current);
            io.disconnect();
            observer.disconnect();
            dotsRef.current = new Float32Array(0);
            dotCountRef.current = 0;
            canvas.width = 0;
            canvas.height = 0;
        };
    }, [dotSize, gap, glowRadius]);

    return (
        <div ref={containerRef} className={cn("pointer-events-none", className)} aria-hidden="true">
            <canvas ref={canvasRef} className="size-full" />
        </div>
    );
};
