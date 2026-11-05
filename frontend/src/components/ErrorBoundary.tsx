import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error" role="alert">
          <h1>No pudimos mostrar esta pantalla</h1>
          <p>Recarga la página para intentarlo de nuevo.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar página
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
