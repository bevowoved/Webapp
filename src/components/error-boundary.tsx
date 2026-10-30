import React from "react";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";
import { captureException } from "@sentry/react";

type Props = {
    children: React.ReactNode;
};

type State = {
    hasError: boolean;
};

function ErrorFallback() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <h1>{t("common.error")}</h1>
            <Button onClick={() => window.location.reload()}>
                {t("common.goBackHome")}
            </Button>
        </div>
    );
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        // Static import: the SDK is initialised eagerly in main.tsx and lives in the
        // entry chunk, so a dynamic import here would not split it out anyway.
        captureException(error);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorFallback />;
        }
        return this.props.children;
    }
}
