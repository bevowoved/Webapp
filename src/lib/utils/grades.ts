import { Grade } from "@/types/aurion";

export type SemesterId = {
    key: string;
    yearLabel: string;
    sem: 1 | 2;
};

export type GradeBadgeInfo = {
    labelKey: string;
    rawCode: string;
    normalizedCode: string;
};

export type StudentClass =
    | "CPG1_MP2I"
    | "CPG1_MPSI"
    | "CPG2_MPI"
    | "CPG2_PSI"
    | "CIR1"
    | "CIR2";

export type CirModuleWeight = {
    match: string;
    module: string;
    weight: number;
};

export type GradeRarity = {
    id: string;
    labelKey: string;
    shortLabelKey: string;
    min: number;
    color: string;
    glow: string;
};

export type GradeAverageSubject = {
    labelKey: string;
    student: number | null;
    class: number | null;
    subjectCoef: number | null;
    excluded: boolean;
};

export type GradeAverages = {
    overall: { student: number | null; class: number | null };
    bySubject: GradeAverageSubject[];
};

export type GradeEvolutionPoint = {
    date: string;
    student: number | null;
    class: number | null;
};

export const EMPTY_GRADES: Grade[] = [];

export const GRADE_SCALE = 20;

export const GRADE_RARITIES: GradeRarity[] = [
    { id: "consumer", labelKey: "gradesPage.rarity.consumer", shortLabelKey: "gradesPage.rarityShort.consumer", min: 0, color: "#b0c3d9", glow: "rgba(176, 195, 217, 0.55)" },
    { id: "industrial", labelKey: "gradesPage.rarity.industrial", shortLabelKey: "gradesPage.rarityShort.industrial", min: 8, color: "#5e98d9", glow: "rgba(94, 152, 217, 0.55)" },
    { id: "milspec", labelKey: "gradesPage.rarity.milspec", shortLabelKey: "gradesPage.rarityShort.milspec", min: 10, color: "#4b69ff", glow: "rgba(75, 105, 255, 0.6)" },
    { id: "restricted", labelKey: "gradesPage.rarity.restricted", shortLabelKey: "gradesPage.rarityShort.restricted", min: 12, color: "#8847ff", glow: "rgba(136, 71, 255, 0.6)" },
    { id: "classified", labelKey: "gradesPage.rarity.classified", shortLabelKey: "gradesPage.rarityShort.classified", min: 14, color: "#d32ce6", glow: "rgba(211, 44, 230, 0.6)" },
    { id: "covert", labelKey: "gradesPage.rarity.covert", shortLabelKey: "gradesPage.rarityShort.covert", min: 16, color: "#eb4b4b", glow: "rgba(235, 75, 75, 0.65)" },
    { id: "exceedingly-rare", labelKey: "gradesPage.rarity.exceedinglyRare", shortLabelKey: "gradesPage.rarityShort.exceedinglyRare", min: 18, color: "#e4ae39", glow: "rgba(228, 174, 57, 0.75)" },
];

export function parseGradeValue(raw?: string | null): number | null {
    if (!raw?.trim()) return null;
    const n = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

export function parseGradeNumber(raw?: string | null): number {
    return parseGradeValue(raw) ?? Number.NaN;
}

export function detectGradeScale(grade: Pick<Grade, "grade" | "average" | "median" | "min" | "max">): 10 | 20 {
    const values = [grade.grade, grade.average, grade.median, grade.min, grade.max]
        .map((v) => parseGradeValue(v))
        .filter((v): v is number => v !== null && v > 0);
    if (values.length === 0) return 20;
    return values.every((v) => v <= 10) ? 10 : 20;
}

export function getRarityForGrade(value: number): GradeRarity {
    let rarity = GRADE_RARITIES[0]!;
    for (const tier of GRADE_RARITIES) {
        if (value >= tier.min) rarity = tier;
    }
    return rarity;
}

const GRADE_BANDS: Array<[number, number, number]> = [
    [0.12, 2, 8],
    [0.75, 8, 15],
    [0.96, 15, 18],
    [1, 18, GRADE_SCALE],
];

export function gradeValueFrom(random: () => number): number {
    const roll = random();
    let band = GRADE_BANDS[GRADE_BANDS.length - 1]!;
    for (const candidate of GRADE_BANDS) {
        if (roll < candidate[0]) {
            band = candidate;
            break;
        }
    }
    const [, lo, hi] = band;
    return Math.round((lo + random() * (hi - lo)) * 10) / 10;
}

export function formatGradeValue(value: number): string {
    return value.toFixed(1);
}

export function academicStartYear(d: Date): number {
    if (d.getMonth() >= 8) return d.getFullYear();
    if (d.getMonth() === 7 && d.getDate() >= 29) return d.getFullYear();
    return d.getFullYear() - 1;
}

export function semesterFromDate(d: Date): 1 | 2 {
    const m = d.getMonth();
    const day = d.getDate();
    if (m === 7 && day >= 29) return 1;
    if (m >= 8 && !(m === 11 && day >= 30)) return 1;
    return 2;
}

export function semesterIdFromDate(d: Date): SemesterId {
    const startYear = academicStartYear(d);
    const sem = semesterFromDate(d);
    return {
        key: `${startYear}-S${sem}`,
        yearLabel: `${startYear}-${String(startYear + 1).slice(2)}`,
        sem,
    };
}

export function getCurrentSemesterKey(now = new Date()): string {
    return `${academicStartYear(now)}-S${semesterFromDate(now)}`;
}

export function frDateToIso(date?: string | null): string | null {
    if (!date) return null;
    const parts = date.split("/");
    if (parts.length !== 3) return null;
    const [day, month, yearRaw] = parts;
    if (!day || !month || !yearRaw) return null;
    const year = yearRaw.length === 2 ? String(2000 + Number(yearRaw)) : yearRaw;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseFrDate(date?: string | null): Date | null {
    const iso = frDateToIso(date);
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const out = new Date(y!, m! - 1, d!);
    return Number.isNaN(out.getTime()) ? null : out;
}

function isArtifactGrade(grade: Grade): boolean {
    const values = Object.values(grade).map((v) => (v ?? "").toString().trim());
    return values.every((v) => v === "");
}

function semesterFromCode(code: string): 1 | 2 | null {
    const m = code.match(/_PART([12])(?:_|$)/i) ?? code.match(/_S([1-9])(?:_|$)/i);
    if (!m) return null;
    return Number(m[1]) % 2 === 0 ? 2 : 1;
}

export function getGradeSemester(grade: Grade): SemesterId | null {
    const d = parseFrDate(grade.date);
    if (!d) return null;
    const startYear = academicStartYear(d);
    const sem = semesterFromCode(grade.code) ?? semesterFromDate(d);
    return {
        key: `${startYear}-S${sem}`,
        yearLabel: `${startYear}-${String(startYear + 1).slice(2)}`,
        sem,
    };
}

const SUBJECT_NAMES = ["maths", "physics", "sii", "computerScience", "fhs", "english", "eps", "lv2", "tipe", "pix", "stage", "projet"] as const;

type SubjectName = (typeof SUBJECT_NAMES)[number];

const SUBJECT = Object.fromEntries(SUBJECT_NAMES.map((name) => [name, `gradesPage.subjects.${name}`])) as Record<SubjectName, string>;

const pairs = (entries: string): string[][] => entries.split(",").map((entry) => entry.split(":"));

const coefficients = (entries: string): Record<string, number> =>
    Object.fromEntries(pairs(entries).map(([key, value]) => [SUBJECT[key as SubjectName], Number(value)]));

const CLASS_PATTERNS: Array<[string, StudentClass]> = [
    ["CPG1_MP2I", "CPG1_MP2I"],
    ["CPG1_MPSI", "CPG1_MPSI"],
    ["CPG2_MPI", "CPG2_MPI"],
    ["CPG2_PSI", "CPG2_PSI"],
    ["_ISEN_A1_", "CIR1"],
    ["_ISEN_A2_", "CIR2"],
    ["CIR1", "CIR1"],
    ["CIR2", "CIR2"],
];

const gradeBadgeKeywordMap: Array<[string, string]> = pairs(
    "math:maths,phys:physics,optique:physics,info:computerScience,prog:computerScience,web:computerScience,anglais:english,sii:sii,elec:physics,meca:physics,thermo:physics,onde:physics,autom:physics,autoseq:physics,bdd:computerScience,embarq:computerScience,algo:computerScience,logique:computerScience,fhs:fhs,comm:fhs,ecrit:fhs,oral:fhs,epistemo:fhs,promo:fhs,societe:fhs,scisoc:fhs,intercultur:fhs,comp_rel:fhs,odd:fhs,eps:eps,lv2:lv2,langue vivante:lv2,tipe:tipe,projet passion:tipe,stage:stage,projet:projet,pix:pix"
).map(([keyword, subject]) => [keyword!, SUBJECT[subject as SubjectName]]);

const subjectCoefficientsPerClass: Record<Exclude<StudentClass, "CIR1" | "CIR2">, Record<string, number>> = {
    CPG1_MP2I: coefficients("maths:8,physics:6,sii:2,computerScience:6,fhs:2,english:2,eps:1,lv2:2,tipe:1"),
    CPG1_MPSI: coefficients("maths:8,physics:8,sii:4,computerScience:2,fhs:2,english:2,eps:1,lv2:2,tipe:1,pix:1"),
    CPG2_MPI: coefficients("maths:8,physics:6,computerScience:6,fhs:2,english:2,eps:1,lv2:2,tipe:1"),
    CPG2_PSI: coefficients("maths:8,physics:8,sii:4,computerScience:2,fhs:2,english:2,eps:1,lv2:2,tipe:1,pix:1"),
};

const cirSubjectCoefficients: Record<"CIR1" | "CIR2", [Record<string, number>, Record<string, number>]> = {
    CIR1: [
        coefficients("maths:9,physics:8,computerScience:7,english:3,fhs:3"),
        coefficients("maths:8,physics:7,computerScience:7,english:3,fhs:3"),
    ],
    CIR2: [
        coefficients("maths:8,physics:5,computerScience:8,english:2.5,fhs:4.5,stage:2"),
        coefficients("maths:8,physics:7,computerScience:6,english:3,fhs:3,projet:3"),
    ],
};

const weights = (entries: string): CirModuleWeight[] =>
    entries.split(",").map((entry) => {
        const [match, module, weight] = entry.split(":");
        return { match: match!, module: module!, weight: Number(weight) };
    });

const cirModuleWeights: Record<"CIR1" | "CIR2", [CirModuleWeight[], CirModuleWeight[]]> = {
    CIR1: [
        weights("MATH1:MATH1:40,MATH2:MATH2:40,MATH_TP:MATH_TP:20,OPTIQUE:OPTIQUE:25,ELEC_TP:ELEC_TP:25,ELEC:ELEC:50,PROG1_TPA:PROG1_TP:35,INFO_PRAT:PROG1_TP:35,PROG1:PROG1:15,WEB:WEB:50,ANGLAIS:ANGLAIS:50,COMM:COMM:50"),
        weights("MATH3:MATH3:40,MATH4:MATH4:40,MATH_TP:MATH_TP:20,ELEC_TP:ELEC_TP:20,MECA:MECA:50,THERMO:THERMO:30,PROG2_TPC:PROG2_TPC:15,PROG2:PROG2:50,BDD:BDD:10,INFO_WEB:WEB:25,WEB:WEB:25,ANGLAIS:ANGLAIS:50,ECRIT:ECRIT:10,ORAL:ORAL:10,EPISTEMO:EPISTEMO:20,PROMOTION:PROMOTION:10,PROJ_INFO:PROJ_INFO:14,PROJ_ELEC:PROJ_ELEC:14"),
    ],
    CIR2: [
        weights("MATH5:MATH5:40,MATH6:MATH6:40,MATHS_TP:MATHS_TP:20,ELECMAG:ELECMAG:70,ELEC:ELECMAG:70,AUTOSEQ:AUTOSEQ:30,PROG3:PROG3:70,INFO_ARDUINO:INFO_ARDUINO:30,ANGLAIS:ANGLAIS:35,SCISOC:SCISOC:30,ECRIT:ECRIT:10,ORAL:ORAL:10,EPISTEMO:EPISTEMO:15,STAGE:STAGE:100"),
        weights("MATH7:MATH7:40,MATH8:MATH8:40,MATHS_TP:MATHS_TP:20,ONDES:ONDES:30,ELEC:ELEC:40,AUTOSEQ:AUTOSEQ2:30,PROG4:PROG4:70,WEB:WEB:30,ANGLAIS:ANGLAIS:50,COMP_REL:COMP_REL:20,INTERCULTUREL:INTERCULTUREL:20,PROMOTION:PROMOTION:10,ODD:ODD:10,PROJET:PROJET:100"),
    ],
};

const LV2_LABEL_KEY = "gradesPage.subjects.lv2";

const badgeCache = new Map<string, GradeBadgeInfo | null>();
const MAX_BADGE_CACHE = 512;

type ModuleAcc = {
    weight: number;
    studentSum: number;
    studentCoef: number;
    classSum: number;
    classCoef: number;
};

type SubjectAcc = {
    labelKey: string;
    modules: Map<string, ModuleAcc>;
    hasUnknownModule: boolean;
    studentSum: number;
    studentCoef: number;
    classSum: number;
    classCoef: number;
};

const averagesCache = new WeakMap<Grade[], GradeAverages>();
const evolutionCache = new WeakMap<Grade[], GradeEvolutionPoint[]>();

export function detectStudentClass(grades: Grade[]): StudentClass | null {
    let best: { cls: StudentClass; date: number } | null = null;
    for (const grade of grades) {
        const upper = grade.code.toUpperCase();
        let cls: StudentClass | undefined;
        for (const [pattern, value] of CLASS_PATTERNS) {
            if (upper.includes(pattern)) {
                cls = value;
                break;
            }
        }
        if (!cls) continue;
        const time = parseFrDate(grade.date)?.getTime() ?? 0;
        if (best === null || time >= best.date) best = { cls, date: time };
    }
    return best?.cls ?? null;
}

export function isCpgClass(cls: StudentClass | null): boolean {
    return cls !== null && cls.startsWith("CPG");
}

export function isCirClass(cls: StudentClass | null): cls is "CIR1" | "CIR2" {
    return cls === "CIR1" || cls === "CIR2";
}

function detectCirSemester(grades: Grade[]): 0 | 1 {
    let best: { sem: 1 | 2; date: number } | null = null;
    for (const grade of grades) {
        const sem = semesterFromCode(grade.code);
        if (!sem) continue;
        const time = parseFrDate(grade.date)?.getTime() ?? 0;
        if (best === null || time >= best.date) best = { sem, date: time };
    }
    return best?.sem === 2 ? 1 : 0;
}

export function getSubjectCoefficients(grades: Grade[]): Record<string, number> {
    const cls = detectStudentClass(grades);
    if (isCirClass(cls)) return cirSubjectCoefficients[cls][detectCirSemester(grades)];
    return subjectCoefficientsPerClass[cls ?? "CPG1_MP2I"];
}

export function getCirModuleWeights(grades: Grade[]): CirModuleWeight[] | null {
    const cls = detectStudentClass(grades);
    if (!isCirClass(cls)) return null;
    return cirModuleWeights[cls][detectCirSemester(grades)];
}

export function getGradeSemesters(grades: Grade[]): SemesterId[] {
    const map = new Map<string, SemesterId>();
    for (const grade of grades) {
        if (isArtifactGrade(grade)) continue;
        const s = getGradeSemester(grade);
        if (s) map.set(s.key, s);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function getGrades({ semesterKey, grades }: { semesterKey?: string | null; grades: Grade[] }): Grade[] {
    return grades.filter((grade) => {
        if (isArtifactGrade(grade)) return false;
        if (semesterKey) return getGradeSemester(grade)?.key === semesterKey;
        return true;
    });
}

export function getGradeBadgeInfoFromCode(code?: string | null): GradeBadgeInfo | null {
    const rawCode = (code ?? "").trim();
    if (!rawCode) return null;
    const cached = badgeCache.get(rawCode);
    if (cached !== undefined) return cached;
    const normalizedBase = rawCode
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const searchableCode = normalizedBase.toLowerCase();
    let labelKey = "";
    for (const [keyword, key] of gradeBadgeKeywordMap) {
        if (searchableCode.includes(keyword)) {
            labelKey = key;
            break;
        }
    }
    const info: GradeBadgeInfo = {
        labelKey,
        rawCode,
        normalizedCode: normalizedBase.toUpperCase(),
    };
    if (badgeCache.size >= MAX_BADGE_CACHE) badgeCache.clear();
    badgeCache.set(rawCode, info);
    return info;
}

function findModule(moduleWeights: CirModuleWeight[] | null, info: GradeBadgeInfo | null, code: string): CirModuleWeight | null {
    if (!moduleWeights) return null;
    const normalizedCode = info?.normalizedCode ?? code.toUpperCase();
    for (const m of moduleWeights) {
        if (normalizedCode.includes(m.match)) return m;
    }
    return null;
}

function computeAveragesUncached(grades: Grade[]): GradeAverages {
    const coefficients = getSubjectCoefficients(grades);
    const moduleWeights = getCirModuleWeights(grades);
    const subjectMap = new Map<string, SubjectAcc>();

    for (const grade of grades) {
        const g = parseGradeValue(grade.grade);
        const avg = parseGradeValue(grade.average);
        const isPartiel = grade.code.toUpperCase().includes("PART");
        const rawCoef = parseGradeValue(grade.coefficient) ?? 1;
        const coef = moduleWeights !== null ? rawCoef : rawCoef * (isPartiel ? 1 : 2);
        const info = getGradeBadgeInfoFromCode(grade.code);
        const labelKey = info?.labelKey || grade.code;
        const module = findModule(moduleWeights, info, grade.code);

        let s = subjectMap.get(labelKey);
        if (s === undefined) {
            s = {
                labelKey,
                modules: new Map(),
                hasUnknownModule: false,
                studentSum: 0,
                studentCoef: 0,
                classSum: 0,
                classCoef: 0,
            };
            subjectMap.set(labelKey, s);
        }
        if (g !== null) {
            s.studentSum += g * coef;
            s.studentCoef += coef;
        }
        if (avg !== null) {
            s.classSum += avg * coef;
            s.classCoef += coef;
        }
        if (moduleWeights !== null) {
            if (module) {
                let mod = s.modules.get(module.module);
                if (mod === undefined) {
                    mod = { weight: module.weight, studentSum: 0, studentCoef: 0, classSum: 0, classCoef: 0 };
                    s.modules.set(module.module, mod);
                }
                if (g !== null) {
                    mod.studentSum += g * coef;
                    mod.studentCoef += coef;
                }
                if (avg !== null) {
                    mod.classSum += avg * coef;
                    mod.classCoef += coef;
                }
            } else {
                s.hasUnknownModule = true;
            }
        }
    }

    const massAvg = (sum: number, coefSum: number) => (coefSum > 0 ? sum / coefSum : null);

    const moduleAvg = (s: SubjectAcc, kind: "student" | "class") => {
        let sum = 0;
        let totalWeight = 0;
        for (const mod of s.modules.values()) {
            const coefSum = kind === "student" ? mod.studentCoef : mod.classCoef;
            if (coefSum <= 0) continue;
            const value = kind === "student" ? mod.studentSum / mod.studentCoef : mod.classSum / mod.classCoef;
            sum += mod.weight * value;
            totalWeight += mod.weight;
        }
        return totalWeight > 0 ? sum / totalWeight : null;
    };

    const bySubject: GradeAverageSubject[] = [];
    for (const s of subjectMap.values()) {
        const exact = moduleWeights !== null && !s.hasUnknownModule && s.modules.size > 0;
        bySubject.push({
            labelKey: s.labelKey,
            student: exact ? moduleAvg(s, "student") : massAvg(s.studentSum, s.studentCoef),
            class: exact ? moduleAvg(s, "class") : massAvg(s.classSum, s.classCoef),
            subjectCoef: coefficients[s.labelKey] ?? null,
            excluded: false,
        });
    }

    const computeOverall = (subjects: GradeAverageSubject[]) => {
        let studentSum = 0;
        let classSum = 0;
        let studentTotalCoef = 0;
        let classTotalCoef = 0;
        for (const s of subjects) {
            if (s.excluded) continue;
            const sc = s.subjectCoef ?? 1;
            if (s.student !== null) {
                studentSum += s.student * sc;
                studentTotalCoef += sc;
            }
            if (s.class !== null) {
                classSum += s.class * sc;
                classTotalCoef += sc;
            }
        }
        return {
            student: studentTotalCoef > 0 ? studentSum / studentTotalCoef : null,
            class: classTotalCoef > 0 ? classSum / classTotalCoef : null,
        };
    };

    const lv2 = bySubject.find((s) => s.labelKey === LV2_LABEL_KEY);
    if (lv2 && lv2.student !== null) {
        lv2.excluded = true;
        const without = computeOverall(bySubject);
        lv2.excluded = false;
        const withLv2 = computeOverall(bySubject);
        if (without.student !== null && withLv2.student !== null && withLv2.student <= without.student) {
            lv2.excluded = true;
        }
    }

    return { overall: computeOverall(bySubject), bySubject };
}

export function computeAverages(grades: Grade[]): GradeAverages {
    const hit = averagesCache.get(grades);
    if (hit !== undefined) return hit;
    const value = computeAveragesUncached(grades);
    averagesCache.set(grades, value);
    return value;
}

export function computeAverageEvolution(grades: Grade[]): GradeEvolutionPoint[] {
    const hit = evolutionCache.get(grades);
    if (hit !== undefined) return hit;

    const sorted = grades.filter((g) => g.date).slice();
    if (sorted.length === 0) {
        evolutionCache.set(grades, []);
        return [];
    }
    const keyed = sorted.map((g) => {
        const parsed = parseFrDate(g.date);
        return { grade: g, ms: parsed === null ? Number.NaN : parsed.getTime() };
    });
    keyed.sort((a, b) => a.ms - b.ms);
    sorted.length = 0;
    for (const k of keyed) sorted.push(k.grade);

    const points: GradeEvolutionPoint[] = [];
    const dateToIdx = new Map<string, number>();

    for (let i = 0; i < sorted.length; i += 1) {
        const avg = computeAverages(sorted.slice(0, i + 1));
        const dateKey = sorted[i]!.date;
        const point: GradeEvolutionPoint = { date: dateKey, student: avg.overall.student, class: avg.overall.class };
        const existing = dateToIdx.get(dateKey);
        if (existing !== undefined) points[existing] = point;
        else {
            dateToIdx.set(dateKey, points.length);
            points.push(point);
        }
    }

    evolutionCache.set(grades, points);
    return points;
}
