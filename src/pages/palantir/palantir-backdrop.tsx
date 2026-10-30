import { useEffect, useRef } from "react";


type Orbiter = {
    radius: number;
    angle: number;
    speed: number;
    trail: number;
    alpha: number;
    width: number;
};

type Faller = {
    radius: number;
    angle: number;
    alpha: number;
    width: number;
};

type Ember = {
    x: number;
    y: number;
    rise: number;
    sway: number;
    phase: number;
    size: number;
    alpha: number;
};

type Meteor = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
};

const SQUASH = 0.26;

const TILT = -0.12;

const TAU = Math.PI * 2;

const makeOrbiters = (count: number): Orbiter[] =>
    Array.from({ length: count }, () => {
        const radius = 0.5 + Math.pow(Math.random(), 1.7) * 0.5;
        return {
            radius,
            angle: Math.random() * TAU,
            speed: 0.00025 / Math.pow(radius, 1.5),
            trail: 0.1 + Math.random() * 0.3,
            alpha: 0.25 + Math.random() * 0.75,
            width: 0.6 + Math.random() * 1.8,
        };
    });

const makeFallers = (count: number): Faller[] =>
    Array.from({ length: count }, () => ({
        radius: 0.55 + Math.random() * 0.5,
        angle: Math.random() * TAU,
        alpha: 0.3 + Math.random() * 0.5,
        width: 0.7 + Math.random() * 1.1,
    }));

const makeEmbers = (count: number, w: number, h: number): Ember[] =>
    Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        rise: 0.15 + Math.random() * 0.45,
        sway: 6 + Math.random() * 18,
        phase: Math.random() * TAU,
        size: 0.6 + Math.random() * 1.6,
        alpha: 0.2 + Math.random() * 0.6,
    }));

export function PalantirBackdrop({ compact = false }: { compact?: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const compactRef = useRef(compact);

    useEffect(() => {
        compactRef.current = compact;
    }, [compact]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        let width = 0;
        let height = 0;
        let viewHeight = 0;
        let orbiters: Orbiter[] = [];
        let fallers: Faller[] = [];
        let embers: Ember[] = [];
        let meteor: Meteor | null = null;
        let meteorCooldown = 2500;
        let time = 0;
        let centerY = 0.42;
        let scale = 1;

        let tiltTargetX = 0;
        let tiltTargetY = 0;
        let tiltX = 0;
        let tiltY = 0;
        const clampTilt = (v: number) => Math.max(-1, Math.min(1, v));

        const onPointerMove = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            tiltTargetX = clampTilt((e.clientX / window.innerWidth - 0.5) * 2);
            tiltTargetY = clampTilt(
                (e.clientY / window.innerHeight - 0.5) * 2
            );
        };
        const onTilt = (e: DeviceOrientationEvent) => {
            tiltTargetX = clampTilt((e.gamma ?? 0) / 15);
            tiltTargetY = clampTilt(((e.beta ?? 0) - 45) / 15);
        };
        const enableOrientation = () =>
            window.addEventListener("deviceorientation", onTilt);

        let orientationAsk: (() => void) | null = null;
        if (!reduced) {
            window.addEventListener("pointermove", onPointerMove);
            const D =
                DeviceOrientationEvent as unknown as {
                    requestPermission?: () => Promise<string>;
                };
            if (typeof D.requestPermission === "function") {
                orientationAsk = () => {
                    D.requestPermission?.()
                        .then((state) => {
                            if (state === "granted") enableOrientation();
                        })
                        .catch(() => {});
                };
                window.addEventListener("touchend", orientationAsk, {
                    once: true,
                });
            } else {
                enableOrientation();
            }
        }

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            if (!width || !height) return;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const top = rect.top + window.scrollY;
            viewHeight = Math.max(
                1,
                Math.min(height, window.innerHeight - top)
            );

            const count = Math.round(
                Math.min(260, Math.max(90, (width * height) / 5200))
            );
            if (count !== orbiters.length) orbiters = makeOrbiters(count);
            fallers = makeFallers(
                Math.round(Math.min(16, Math.max(8, width / 60)))
            );
            embers = makeEmbers(
                Math.round(Math.min(46, Math.max(18, width / 26))),
                width,
                height
            );
        };

        const drawHorizon = (cx: number, cy: number, r: number) => {
            ctx.globalCompositeOperation = "source-over";
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, TAU);
            ctx.fillStyle = "#000";
            ctx.fill();

            ctx.globalCompositeOperation = "lighter";
            ctx.beginPath();
            ctx.arc(cx, cy, r * 1.02, 0, TAU);
            ctx.strokeStyle = `rgba(215,205,255,${(
                0.4 + 0.1 * Math.sin(time * 0.0011)
            ).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
        };

        const draw = () => {
            const targetY = compactRef.current ? 0.28 : 0.42;
            const targetScale = compactRef.current ? 0.6 : 1;
            centerY += (targetY - centerY) * 0.05;
            scale += (targetScale - scale) * 0.05;

            const cx = width / 2;
            const cy = viewHeight * centerY;
            const disk = Math.min(width * 0.44, viewHeight * 0.44) * scale;
            const stone = disk * 0.34;

            ctx.clearRect(0, 0, width, height);

            const drawOrbiter = (p: Orbiter, far: boolean) => {
                if (Math.sin(p.angle) < 0 !== far) return;

                const r = disk * p.radius;
                const beaming = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(p.angle));
                const heat = 1 - (p.radius - 0.5) / 0.5;
                const arm =
                    p.angle + Math.log(p.radius) * 3.5 - time * 0.00012;
                const inArm = 0.5 + 0.5 * Math.cos(2 * arm);
                const wave = 0.7 + 0.6 * inArm * inArm * inArm;
                ctx.beginPath();
                ctx.ellipse(
                    cx,
                    cy,
                    r,
                    r * SQUASH,
                    0,
                    p.angle - p.trail,
                    p.angle
                );
                ctx.strokeStyle = `rgba(${Math.round(170 + 85 * heat)},${Math.round(
                    110 + 110 * heat
                )},${Math.round(255 - 110 * heat)},${
                    p.alpha * beaming * wave * (far ? 0.55 : 1)
                })`;
                ctx.lineWidth = p.width;
                ctx.lineCap = "round";
                ctx.stroke();
            };

            const drawFaller = (f: Faller, far: boolean) => {
                if (Math.sin(f.angle) < 0 !== far) return;
                const r = disk * f.radius;
                const infall = 1 - Math.min(1, (f.radius - 0.36) / 0.64);
                const heat = 0.5 + 0.5 * infall;
                ctx.beginPath();
                ctx.ellipse(cx, cy, r, r * SQUASH, 0, f.angle - 0.09, f.angle);
                ctx.strokeStyle = `rgba(${Math.round(170 + 85 * heat)},${Math.round(
                    110 + 110 * heat
                )},${Math.round(255 - 110 * heat)},${
                    f.alpha * (0.35 + 0.65 * infall)
                })`;
                ctx.lineWidth = f.width;
                ctx.lineCap = "round";
                ctx.stroke();
            };

            const beginTilt = () => {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(TILT);
                ctx.translate(-cx, -cy);
            };

            ctx.globalCompositeOperation = "lighter";
            beginTilt();
            for (const p of orbiters) drawOrbiter(p, true);
            for (const f of fallers) drawFaller(f, true);
            ctx.restore();

            drawHorizon(cx, cy, stone);

            beginTilt();
            for (const p of orbiters) drawOrbiter(p, false);
            for (const f of fallers) drawFaller(f, false);
            ctx.restore();

            if (meteor) {
                const fade = Math.sin((meteor.life / meteor.maxLife) * Math.PI);
                const tailX = meteor.x - meteor.vx * 14;
                const tailY = meteor.y - meteor.vy * 14;
                const tail = ctx.createLinearGradient(
                    meteor.x,
                    meteor.y,
                    tailX,
                    tailY
                );
                tail.addColorStop(0, `rgba(240,236,255,${0.85 * fade})`);
                tail.addColorStop(1, "rgba(160,140,255,0)");
                ctx.beginPath();
                ctx.moveTo(meteor.x, meteor.y);
                ctx.lineTo(tailX, tailY);
                ctx.strokeStyle = tail;
                ctx.lineWidth = 1.4;
                ctx.lineCap = "round";
                ctx.stroke();
            }

            for (const e of embers) {
                const x = e.x + Math.sin(time * 0.0007 + e.phase) * e.sway;
                ctx.beginPath();
                ctx.arc(x, e.y, e.size, 0, TAU);
                ctx.fillStyle = `rgba(210,196,255,${e.alpha})`;
                ctx.fill();
            }

            ctx.globalCompositeOperation = "source-over";
        };

        let frame = 0;
        const loop = () => {
            time += 16;
            tiltX += (tiltTargetX - tiltX) * 0.08;
            tiltY += (tiltTargetY - tiltY) * 0.08;
            backdropRef.current?.style.setProperty(
                "--pv-px",
                tiltX.toFixed(4)
            );
            backdropRef.current?.style.setProperty(
                "--pv-py",
                tiltY.toFixed(4)
            );
            for (const p of orbiters) {
                p.angle += p.speed * 16;
                if (p.angle > TAU) p.angle -= TAU;
            }
            for (const f of fallers) {
                f.angle += (0.00025 / Math.pow(f.radius, 1.5)) * 16;
                if (f.angle > TAU) f.angle -= TAU;
                f.radius -= (0.000033 / f.radius) * 16;
                if (f.radius <= 0.36) {
                    f.radius = 0.85 + Math.random() * 0.25;
                    f.angle = Math.random() * TAU;
                }
            }
            for (const e of embers) {
                e.y -= e.rise;
                if (e.y < -4) {
                    e.y = height + 4;
                    e.x = Math.random() * width;
                }
            }
            if (meteor) {
                meteor.x += meteor.vx;
                meteor.y += meteor.vy;
                meteor.life += 1;
                if (
                    meteor.life >= meteor.maxLife ||
                    meteor.x < -60 ||
                    meteor.x > width + 60 ||
                    meteor.y > height + 60
                ) {
                    meteor = null;
                    meteorCooldown = 4000 + Math.random() * 9000;
                }
            } else {
                meteorCooldown -= 16;
                if (meteorCooldown <= 0) {
                    const dir = Math.random() > 0.5 ? 1 : -1;
                    meteor = {
                        x: dir > 0 ? -30 : width + 30,
                        y: Math.random() * height * 0.45,
                        vx: dir * (2.4 + Math.random() * 1.8),
                        vy: 0.7 + Math.random() * 0.7,
                        life: 0,
                        maxLife: 50 + Math.random() * 40,
                    };
                }
            }
            draw();
            frame = requestAnimationFrame(loop);
        };

        const observer = new ResizeObserver(() => {
            resize();
            if (reduced) draw();
        });
        observer.observe(canvas);

        resize();
        if (reduced) {
            draw();
        } else {
            frame = requestAnimationFrame(loop);
        }

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("deviceorientation", onTilt);
            if (orientationAsk) {
                window.removeEventListener("touchend", orientationAsk);
            }
        };
    }, []);

    return (
        <div className="pv-backdrop" ref={backdropRef} aria-hidden="true">
            <div className="pv-stars pv-stars-far" />
            <div className="pv-stars pv-stars-near" />
            <div className="pv-stars pv-stars-dust" />
            <div className="pv-nebula" />
            <canvas ref={canvasRef} className="pv-canvas" />
            <div className="pv-grain" />
            <div className="pv-vignette" />
        </div>
    );
}
