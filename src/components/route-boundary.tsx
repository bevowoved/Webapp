import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { captureReactException } from "@sentry/react";
import { Button } from "./ui/button";
import { queryClient } from "@/lib/query-client";

type Props = {
    children: ReactNode;
    scope: string;
    compact?: boolean;
};

type State = {
    error: Error | null;
    retrying: boolean;
};

const report = (error: unknown, info: ErrorInfo, scope: string, route: string): void => {
    // Static import: initialised eagerly in main.tsx, already in the entry chunk.
    captureReactException(error, info, {
        tags: { boundary: scope, route },
        contexts: { react: { componentStack: info.componentStack ?? null } },
    });
};

function Fallback({
    scope,
    compact,
    retrying,
    onRetry,
}: {
    scope: string;
    compact: boolean;
    retrying: boolean;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const body = (
        <>
            <p className="text-lg font-medium">{t("common.error")}</p>
            <p className="text-sm text-muted-foreground">
                {t("common.errorScope", { scope })}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button onClick={onRetry} disabled={retrying}>
                    {retrying ? t("common.loading") : t("common.retry")}
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                    {t("common.previous")}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground/60 break-all">{pathname}</p>
        </>
    );

    if (compact) {
        return (
            <div
                role="alert"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
            >
                {body}
            </div>
        );
    }

    return (
        <div
            role="alert"
            className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
        >
            {body}
        </div>
    );
}

export class RouteBoundary extends Component<Props, State> {
    state: State = { error: null, retrying: false };

    private mounted = false;

    static getDerivedStateFromError(error: unknown): Partial<State> {
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    componentDidMount(): void {
        this.mounted = true;
    }

    componentWillUnmount(): void {
        this.mounted = false;
    }

    componentDidCatch(error: unknown, info: ErrorInfo): void {
        report(error, info, this.props.scope, window.location.pathname);
    }

    private readonly retry = (): void => {
        this.setState({ retrying: true });
        void queryClient.resetQueries().finally(() => {
            if (!this.mounted) return;
            this.setState({ error: null, retrying: false });
        });
    };

    render(): ReactNode {
        if (this.state.error === null) return this.props.children;
        return (
            <Fallback
                scope={this.props.scope}
                compact={this.props.compact ?? false}
                retrying={this.state.retrying}
                onRetry={this.retry}
            />
        );
    }
}
