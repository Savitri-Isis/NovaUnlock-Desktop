import React from "react";
import { useDeviceStore } from "../store/device-store";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Erreur inattendue de l'interface",
    };
  }

  componentDidCatch(error: Error): void {
    try {
      useDeviceStore.getState().addLog({
        message: `Erreur critique d'interface: ${error.message}`,
        type: "error",
      });
    } catch {
      // Ignorer si le store n'est pas accessible
    }
  }

  handleRecover = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
    if (typeof window !== "undefined") {
      if (window.location.protocol === "file:") {
        window.location.hash = "#/";
      } else {
        window.history.replaceState({}, "", "/");
      }
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground p-6">
          <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-6 text-center space-y-4">
            <h2 className="text-xl font-bold text-danger">Erreur d'interface</h2>
            <p className="text-sm text-muted">
              Une erreur inattendue est survenue. Les opérations en cours n'ont pas modifié l'appareil.
            </p>
            <p className="text-xs font-mono text-foreground bg-background p-3 rounded-lg break-words">
              {this.state.errorMessage}
            </p>
            <button
              onClick={this.handleRecover}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
            >
              Retour au Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
