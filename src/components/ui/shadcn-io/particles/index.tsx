"use client";

import { cn } from "@/lib/utils/cn";
import React, { useEffect, useMemo, useRef } from "react";

export interface ParticlesProps {
    className?: string;
    quantity?: number;
    staticity?: number;
    ease?: number;
    size?: number;
    refresh?: boolean;
    color?: string;
    vx?: number;
    vy?: number;
}

const DEFAULT_RGB: [number, number, number] = [255, 255, 255];
const STRIDE = 8;
const IDLE_FPS = 10;

function hexToRgb(hex: string): [number, number, number] {
    const normalized = hex.replace("#", "");
    const value =
        normalized.length === 3
            ? normalized
                  .split("")
                  .map((char) => char + char)
                  .join("")
            : normalized;
    if (value.length !== 6) return [...DEFAULT_RGB];
    const hexInt = parseInt(value, 16);
    return [(hexInt >> 16) & 255, (hexInt >> 8) & 255, hexInt & 255];
}

function parseColorToRgbServer(color: string): [number, number, number] {
    const trimmed = color?.trim?.() ?? "";
    if (trimmed.startsWith("#")) return hexToRgb(trimmed);
    return [...DEFAULT_RGB];
}

function parseColorToRgb(color: string): [number, number, number] {
    const trimmed = color?.trim?.() ?? "";
    if (!trimmed || typeof window === "undefined") return parseColorToRgbServer(trimmed);
    const body = document.body;
    if (!body) return parseColorToRgbServer(trimmed);
    const element = document.createElement("span");
    element.style.color = trimmed;
    element.style.display = "none";
    body.appendChild(element);
    try {
        const match = getComputedStyle(element).color.match(/rgba?\((\d+)[,\s]*(\d+)[,\s]*(\d+)/i);
        if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
    } catch {
        return parseColorToRgbServer(trimmed);
    } finally {
        element.remove();
    }
    return trimmed.startsWith("#") ? hexToRgb(trimmed) : [...DEFAULT_RGB];
}

export const Particles: React.FC<ParticlesProps> = ({
    className = "",
    quantity = 100,
    staticity = 50,
    ease = 50,
    size = 0.4,
    color = "var(--particles-color)",
    vx = 0,
    vy = 0,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const animationFrameId = useRef<number>(0);
    const circles = useRef<Float32Array>(new Float32Array(0));
    const countRef = useRef<number>(0);
    const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
    const rectRef = useRef<DOMRect | null>(null);
    const visibleRef = useRef<boolean>(true);
    const lastFrameRef = useRef<number>(0);
    const lastInputRef = useRef<number>(0);
    const dprRef = useRef<number>(1);

    const initialResolvedRgb = useMemo<[number, number, number]>(() => {
        if (typeof window === "undefined") return parseColorToRgbServer(color);
        return parseColorToRgb(color);
    }, [color]);
    const resolvedRgbRef = useRef<[number, number, number]>(initialResolvedRgb);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        contextRef.current = canvas.getContext("2d");
        const ctx = contextRef.current;
        if (!ctx) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const resizeCanvas = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            dprRef.current = dpr;
            canvasSize.current.w = container.offsetWidth;
            canvasSize.current.h = container.offsetHeight;
            canvas.width = Math.max(1, Math.round(canvasSize.current.w * dpr));
            canvas.height = Math.max(1, Math.round(canvasSize.current.h * dpr));
            canvas.style.width = `${canvasSize.current.w}px`;
            canvas.style.height = `${canvasSize.current.h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            rectRef.current = canvas.getBoundingClientRect();
        };

        const seed = () => {
            const total = quantity;
            const buf = new Float32Array(total * STRIDE);
            for (let i = 0; i < total; i += 1) {
                const o = i * STRIDE;
                buf[o] = Math.floor(Math.random() * canvasSize.current.w);
                buf[o + 1] = Math.floor(Math.random() * canvasSize.current.h);
                buf[o + 2] = 0;
                buf[o + 3] = 0;
                buf[o + 4] = Math.floor(Math.random() * 2) + size;
                buf[o + 5] = 0;
                buf[o + 6] = parseFloat((Math.random() * 0.6 + 0.1).toFixed(1));
                buf[o + 7] = 0.1 + Math.random() * 4;
            }
            circles.current = buf;
            countRef.current = total;
        };

        const resetCircle = (i: number) => {
            const buf = circles.current;
            const o = i * STRIDE;
            buf[o] = Math.floor(Math.random() * canvasSize.current.w);
            buf[o + 1] = Math.floor(Math.random() * canvasSize.current.h);
            buf[o + 2] = 0;
            buf[o + 3] = 0;
            buf[o + 4] = Math.floor(Math.random() * 2) + size;
            buf[o + 5] = 0;
            buf[o + 6] = parseFloat((Math.random() * 0.6 + 0.1).toFixed(1));
            buf[o + 7] = 0.1 + Math.random() * 4;
        };

        const animate = (now: number) => {
            animationFrameId.current = window.requestAnimationFrame(animate);
            if (!visibleRef.current || document.hidden) return;

            const idle = now - lastInputRef.current > 400;
            const minDelta = 1000 / (idle ? IDLE_FPS : 60);
            if (now - lastFrameRef.current < minDelta) return;
            lastFrameRef.current = now;

            const w = canvasSize.current.w;
            const h = canvasSize.current.h;
            const buf = circles.current;
            const total = countRef.current;
            const [red, green, blue] = resolvedRgbRef.current;
            const mx = mouse.current.x;
            const my = mouse.current.y;

            ctx.clearRect(0, 0, w, h);
            ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);

            for (let i = total - 1; i >= 0; i -= 1) {
                const o = i * STRIDE;
                const csize = buf[o + 4]!;
                let closest = buf[o]! + buf[o + 2]! - csize;
                const e1 = w - buf[o]! - buf[o + 2]! - csize;
                const e2 = buf[o + 1]! + buf[o + 3]! - csize;
                const e3 = h - buf[o + 1]! - buf[o + 3]! - csize;
                if (e1 < closest) closest = e1;
                if (e2 < closest) closest = e2;
                if (e3 < closest) closest = e3;
                let remap = closest / 20;
                if (remap < 0) remap = 0;
                if (remap > 1) remap = 1;

                const target = buf[o + 6]!;
                let alpha = buf[o + 5]!;
                if (remap >= 1) {
                    alpha += 0.02;
                    if (alpha > target) alpha = target;
                } else {
                    alpha = target * remap;
                }
                buf[o + 5] = alpha;

                buf[o] = buf[o]! + (Math.random() - 0.5) * 0.1 + vx;
                buf[o + 1] = buf[o + 1]! + (Math.random() - 0.5) * 0.1 + vy;
                buf[o + 2] = buf[o + 2]! + (mx / (staticity / buf[o + 7]!) - buf[o + 2]!) / ease;
                buf[o + 3] = buf[o + 3]! + (my / (staticity / buf[o + 7]!) - buf[o + 3]!) / ease;

                const x = buf[o]! + buf[o + 2]!;
                const y = buf[o + 1]! + buf[o + 3]!;
                ctx.beginPath();
                ctx.arc(x, y, csize, 0, 2 * Math.PI);
                ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                ctx.fill();

                if (x < -csize || x > w + csize || y < -csize || y > h + csize) resetCircle(i);
            }
        };

        resizeCanvas();
        seed();
        if (reduced) {
            lastInputRef.current = 0;
            animate(performance.now());
        } else {
            animationFrameId.current = window.requestAnimationFrame(animate);
        }

        const onMouseMove = (e: MouseEvent) => {
            lastInputRef.current = performance.now();
            const rect = rectRef.current ?? canvas.getBoundingClientRect();
            const x = e.clientX - rect.left - canvasSize.current.w / 2;
            const y = e.clientY - rect.top - canvasSize.current.h / 2;
            if (x < canvasSize.current.w / 2 && x > -canvasSize.current.w / 2 && y < canvasSize.current.h / 2 && y > -canvasSize.current.h / 2) {
                mouse.current = { x, y };
            }
        };

        const onScroll = () => {
            rectRef.current = canvas.getBoundingClientRect();
        };

        const io = new IntersectionObserver(
            (entries) => {
                visibleRef.current = entries[0]?.isIntersecting ?? true;
            },
            { threshold: 0 }
        );
        io.observe(canvas);

        const ro = new ResizeObserver(() => {
            resizeCanvas();
            seed();
        });
        ro.observe(container);

        window.addEventListener("mousemove", onMouseMove, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(animationFrameId.current);
            io.disconnect();
            ro.disconnect();
            circles.current = new Float32Array(0);
            countRef.current = 0;
            canvas.width = 0;
            canvas.height = 0;
        };
    }, [color, quantity, staticity, ease, size, vx, vy]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const updateColor = () => {
            resolvedRgbRef.current = parseColorToRgb(color);
        };
        updateColor();
        const observer = new MutationObserver(updateColor);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
        return () => observer.disconnect();
    }, [color]);

    return (
        <div className={cn("pointer-events-none", className)} ref={containerRef} aria-hidden="true">
            <canvas ref={canvasRef} className="size-full" />
        </div>
    );
};
