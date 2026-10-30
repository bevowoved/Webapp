import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

/**
 * Rendered for any URL the router does not recognise.
 *
 * Without this, an unknown path matched no route at all: React Router rendered
 * nothing, so the user got a completely blank page with no header, no navigation
 * and no way back. The route boundary cannot help here because nothing threw —
 * the shell was never mounted.
 *
 * This lives inside the layout route, so the header, sidebar and bottom nav stay
 * on screen and the user can simply navigate away.
 */
export function NotFound() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    return (
        <div
            role="alert"
            className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
        >
            <p className="text-lg font-medium">{t("common.notFound")}</p>
            <p className="text-sm text-muted-foreground">
                {t("common.notFoundBody")}
            </p>
            <Button onClick={() => navigate("/", { replace: true })}>
                {t("common.goBackHome")}
            </Button>
            <p className="text-xs text-muted-foreground/60 break-all">{pathname}</p>
        </div>
    );
}
