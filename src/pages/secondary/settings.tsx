import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Rainbow,
    Cherry,
    Moon,
    Sun,
    MoonStar,
    TreePine,
    Waves,
    ImageUpscale,
    Languages,
    Wallpaper,
    UtensilsCrossed,
    School,
    TriangleAlert,
    Dices,
    Radar,
    Hourglass,
    type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    useBackground,
    type BackgroundName,
} from "@/components/background-provider";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";
import { applyScale, readInitialSize } from "@/lib/utils/scale";
import type { SizeOption } from "@/lib/utils/scale";
import {
    applyLocale,
    readInitialLocale,
    type LocaleOption,
} from "@/lib/utils/translations";
import {
    GRADE_REVEAL_MODES,
    setGradeRevealMode,
    setPalantirTheme,
    useGradeRevealMode,
    usePalantirTheme,
    type GradeRevealMode,
} from "@/lib/utils/experimental";
import { resetGradeTracking } from "@/lib/utils/unopened-grades";
import {
    setRestaurantMenuEnabled,
    useRestaurantMenuEnabled,
} from "@/lib/utils/restaurant-menu";
import {
    setExtraTimeEnabled,
    useExtraTimeEnabled,
} from "@/lib/utils/extra-time";
import { fadeIn, staggerGroup } from "@/lib/motion";
import {
    CAMPUS_OPTIONS,
    readCampus,
    setCampus,
    type Campus,
} from "@/lib/utils/campus";

type SelectOption = { value: string; label: string };

type SelectorSetting = {
    icon: LucideIcon;
    title: string;
    value: string;
    selectValue: string;
    onValueChange: (value: string) => void;
    options: SelectOption[];
};

type ToggleSetting = {
    icon: LucideIcon;
    id: string;
    title: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
};

const SectionTitle = ({ title }: { title: string }) => (
    <motion.div variants={fadeIn} className="flex items-center justify-center">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
        </h2>
    </motion.div>
);

const SettingRow = ({
    icon: Icon,
    label,
    description,
    htmlFor,
    control,
}: {
    icon: LucideIcon;
    label: string;
    description: string;
    htmlFor?: string;
    control: React.ReactNode;
}) => (
    <motion.div
        variants={fadeIn}
        className="flex items-center justify-between gap-4"
    >
        <div className="flex min-w-0 flex-1 items-center gap-3 [&_svg]:size-7!">
            <Icon className="h-5 w-5 shrink-0" />
            <div className="flex min-w-0 flex-col items-start">
                <Label
                    htmlFor={htmlFor}
                    className={htmlFor ? "cursor-pointer text-left" : "cursor-default text-left"}
                >
                    {label}
                </Label>
                <span className="text-xs text-muted-foreground text-left">
                    {description}
                </span>
            </div>
        </div>
        <div className="flex shrink-0 justify-end">{control}</div>
    </motion.div>
);

const SelectSetting = ({ setting }: { setting: SelectorSetting }) => (
    <SettingRow
        icon={setting.icon}
        label={setting.title}
        description={setting.value}
        control={
            <Select
                value={setting.selectValue}
                onValueChange={setting.onValueChange}
            >
                <SelectTrigger
                    className="h-8 w-[150px] justify-between rounded-md border border-border/50 px-2 text-xs focus:ring-0 focus:ring-offset-0"
                    aria-label={setting.title}
                >
                    <SelectValue
                        placeholder={setting.title}
                        className="!items-end flex"
                    />
                </SelectTrigger>
                <SelectContent className="text-xs">
                    {setting.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        }
    />
);

const SwitchSetting = ({ setting }: { setting: ToggleSetting }) => (
    <SettingRow
        icon={setting.icon}
        label={setting.title}
        description={setting.description}
        htmlFor={setting.id}
        control={
            <Switch
                id={setting.id}
                checked={setting.checked}
                onCheckedChange={setting.onCheckedChange}
                aria-label={setting.title}
            />
        }
    />
);

const SeparatorRow = () => (
    <motion.div variants={fadeIn}>
        <Separator />
    </motion.div>
);

export function SettingsPage() {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const gradeRevealMode = useGradeRevealMode();
    const palantirTheme = usePalantirTheme();
    const { background, setBackground, options } = useBackground();
    const selectedBackgroundLabel = t(
        `sidebar.backgroundParameter.${background}`
    );

    const handleGradeRevealModeChange = (value: string) => {
        if (!GRADE_REVEAL_MODES.includes(value as GradeRevealMode)) return;

        const mode = value as GradeRevealMode;
        setGradeRevealMode(mode);
        if ((gradeRevealMode === "off") !== (mode === "off")) {
            resetGradeTracking();
        }
    };

    const handleBackgroundChange = (value: string) => {
        if (!value) return;
        setBackground(value as BackgroundName);
    };

    const themeDisplay = {
        light: { Icon: Sun, label: t("sidebar.themeParameter.light") },
        dark: { Icon: Moon, label: t("sidebar.themeParameter.dark") },
        oled: { Icon: MoonStar, label: t("sidebar.themeParameter.oled") },
        cherry: { Icon: Cherry, label: t("sidebar.themeParameter.cherry") },
        ocean: { Icon: Waves, label: t("sidebar.themeParameter.ocean") },
        forest: { Icon: TreePine, label: t("sidebar.themeParameter.forest") },
        pride: { Icon: Rainbow, label: t("sidebar.themeParameter.pride") },
    } as const;

    const { Icon: ThemeIcon, label: themeLabel } =
        themeDisplay[theme] ?? themeDisplay.light;

    const [size, setSize] = useState<SizeOption>(readInitialSize);
    const [locale, setLocale] = useState<LocaleOption>(readInitialLocale);
    const [campus, setCampusState] = useState<Campus>(readCampus);
    const restaurantMenuEnabled = useRestaurantMenuEnabled();
    const extraTimeEnabled = useExtraTimeEnabled();

    const handleCampusChange = (value: string) => {
        if (!value) return;
        const newCampus = value as Campus;
        setCampusState(newCampus);
        setCampus(newCampus);
    };

    useEffect(() => {
        applyScale(size);
    }, [size]);

    useEffect(() => {
        applyLocale(locale);
    }, [locale]);

    const themeOptions: SelectOption[] = (
        Object.keys(themeDisplay) as Array<keyof typeof themeDisplay>
    ).map((key) => ({
        value: key,
        label: themeDisplay[key].label,
    }));

    const sizeOptions: SelectOption[] = [
        { value: "petit", label: t("sidebar.sizeParameter.small") },
        { value: "moyen", label: t("sidebar.sizeParameter.medium") },
        { value: "grand", label: t("sidebar.sizeParameter.large") },
    ];

    const localeOptions: SelectOption[] = [
        { value: "fr-FR", label: t("sidebar.languageParameter.fr-FR") },
        { value: "en-US", label: t("sidebar.languageParameter.en-US") },
        { value: "es-ES", label: t("sidebar.languageParameter.es-ES") },
    ];

    const sizeLabels: Record<SizeOption, string> = {
        petit: t("sidebar.sizeParameter.small"),
        moyen: t("sidebar.sizeParameter.medium"),
        grand: t("sidebar.sizeParameter.large"),
    };

    const appearanceSelectors: SelectorSetting[] = [
        {
            icon: ThemeIcon,
            title: t("sidebar.themeParameter.title"),
            value: themeLabel,
            selectValue: theme,
            onValueChange: (value: string) =>
                value && setTheme(value as typeof theme),
            options: themeOptions,
        },
        {
            icon: Wallpaper,
            title: t("sidebar.backgroundParameter.title"),
            value: selectedBackgroundLabel,
            selectValue: background,
            onValueChange: handleBackgroundChange,
            options: options.map((option) => ({
                value: option,
                label: t(`sidebar.backgroundParameter.${option}`),
            })),
        },
        {
            icon: ImageUpscale,
            title: t("sidebar.sizeParameter.title"),
            value: sizeLabels[size],
            selectValue: size,
            onValueChange: (v: string) => v && setSize(v as SizeOption),
            options: sizeOptions,
        },
    ];

    const generalSelectors: SelectorSetting[] = [
        {
            icon: Languages,
            title: t("sidebar.languageParameter.title"),
            value: localeOptions.find((o) => o.value === locale)?.label ?? "",
            selectValue: locale,
            onValueChange: (v: string) => v && setLocale(v as LocaleOption),
            options: localeOptions,
        },
        {
            icon: School,
            title: t("sidebar.campusParameter.title"),
            value: t(`sidebar.campusParameter.${campus}`),
            selectValue: campus,
            onValueChange: handleCampusChange,
            options: CAMPUS_OPTIONS.map((option) => ({
                value: option,
                label: t(`sidebar.campusParameter.${option}`),
            })),
        },
    ];

    const toggles: ToggleSetting[] = [
        {
            icon: UtensilsCrossed,
            id: "restaurant-menu",
            title: t("sidebar.restaurantParameter.title"),
            description: restaurantMenuEnabled
                ? t("sidebar.restaurantParameter.enabled")
                : t("sidebar.restaurantParameter.disabled"),
            checked: restaurantMenuEnabled,
            onCheckedChange: setRestaurantMenuEnabled,
        },
        {
            icon: Hourglass,
            id: "extra-time",
            title: t("sidebar.extraTimeParameter.title"),
            description: extraTimeEnabled
                ? t("sidebar.extraTimeParameter.enabled")
                : t("sidebar.extraTimeParameter.disabled"),
            checked: extraTimeEnabled,
            onCheckedChange: setExtraTimeEnabled,
        },
    ];

    return (
        <motion.div
            className="space-y-4 pt-4 pb-4"
            variants={staggerGroup}
            initial="hidden"
            animate="show"
        >
            <SectionTitle title={t("settingsPage.sections.general")} />
            {generalSelectors.map((setting) => (
                <SelectSetting key={setting.title} setting={setting} />
            ))}

            <SeparatorRow />

            <SectionTitle title={t("settingsPage.sections.studentLife")} />
            {toggles.map((setting) => (
                <SwitchSetting key={setting.id} setting={setting} />
            ))}

            <SeparatorRow />

            <SectionTitle title={t("settingsPage.sections.appearance")} />
            {appearanceSelectors.map((setting) => (
                <SelectSetting key={setting.title} setting={setting} />
            ))}

            <SeparatorRow />

            <motion.div
                variants={fadeIn}
                className="flex items-center justify-center gap-3 text-amber-500"
            >
                <TriangleAlert className="size-5 animate-pulse" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                    {t("settingsPage.experimental")}
                </h2>
                <TriangleAlert className="size-5 animate-pulse" />
            </motion.div>

            <motion.div variants={fadeIn}>
                <p className="-mt-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-200">
                    {t("settingsPage.experimentalWarning")}
                </p>
            </motion.div>

            <SettingRow
                icon={Dices}
                label={t("settingsPage.gradeRevealMode.title")}
                description={t(
                    `settingsPage.gradeRevealMode.${gradeRevealMode}`
                )}
                control={
                    <Select
                        value={gradeRevealMode}
                        onValueChange={handleGradeRevealModeChange}
                    >
                        <SelectTrigger
                            className="h-8 w-[150px] justify-between rounded-md border border-border/50 px-2 text-xs focus:ring-0 focus:ring-offset-0"
                            aria-label={t("settingsPage.gradeRevealMode.title")}
                        >
                            <SelectValue
                                placeholder={t(
                                    "settingsPage.gradeRevealMode.title"
                                )}
                                className="!items-end flex"
                            />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                            {GRADE_REVEAL_MODES.map((mode) => (
                                <SelectItem key={mode} value={mode}>
                                    {t(`settingsPage.gradeRevealMode.${mode}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
            />

            <SwitchSetting
                setting={{
                    icon: Radar,
                    id: "palantir-theme",
                    title: t("settingsPage.palantirTheme.title"),
                    description: t("settingsPage.palantirTheme.description"),
                    checked: palantirTheme,
                    onCheckedChange: setPalantirTheme,
                }}
            />
        </motion.div>
    );
}
