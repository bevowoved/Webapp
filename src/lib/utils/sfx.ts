import { getFromStorage } from "./storage";

export const SOUNDS = {
    cs2Tick: "sounds/cs2-tick.mp3",
    cs2Reveal: "sounds/cs2-reveal.mp3",
} as const;

export type SoundName = keyof typeof SOUNDS;

export const HAPTICS_STORAGE_KEY = "hapticsEnabled";

let context: AudioContext | null = null;
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();

const getContext = (): AudioContext | null => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return null;
    context ??= new AudioContext();
    return context;
};

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
        if (!context) return;
        if (document.hidden) {
            if (context.state === "running") void context.suspend();
        } else if (context.state === "suspended") {
            void context.resume();
        }
    });
}

const loadSound = (name: SoundName): Promise<AudioBuffer | null> => {
    let buffer = buffers.get(name);
    if (!buffer) {
        const ctx = getContext();
        buffer = ctx
            ? fetch(`${import.meta.env.BASE_URL}${SOUNDS[name]}`)
                  .then((response) => response.arrayBuffer())
                  .then((data) => ctx.decodeAudioData(data))
                  .catch(() => null)
            : Promise.resolve(null);
        buffers.set(name, buffer);
    }
    return buffer;
};

export const unlockSounds = (...names: SoundName[]) => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    names.forEach(loadSound);
};

export const playSound = (name: SoundName, volume = 1) => {
    const ctx = getContext();
    if (!ctx) return;
    void loadSound(name).then((buffer) => {
        if (!buffer) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(ctx.destination);
        source.start();
    });
};

const vibrate = (pattern: number | number[]): void => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    try {
        if (getFromStorage(HAPTICS_STORAGE_KEY) === "false") return;
        navigator.vibrate(pattern);
    } catch {
        return;
    }
};

export const triggerHaptic = (durationMs = 10): void => vibrate(durationMs);

export const triggerHapticPattern = (pattern: number | number[]): void => vibrate(pattern);
