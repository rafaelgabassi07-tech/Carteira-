
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
      hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
        return (
            <div className="p-4 text-center mt-20 text-[var(--text-primary)]">
                <h1 className="text-2xl font-bold text-red-400">Ops!</h1>
                <p className="text-[var(--text-secondary)] mt-2 mb-6">
                    Algo deu errado. Por favor, tente recarregar a página.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-red-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                >
                    Recarregar
                </button>
            </div>
        );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
