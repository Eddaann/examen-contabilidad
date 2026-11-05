import Button from "../Button";
import "./AppHeader.scss";

interface AppHeaderProps {
  email: string;
  onLogout: () => void;
  loggingOut: boolean;
  error?: string;
}

export default function AppHeader({
  email,
  onLogout,
  loggingOut,
  error,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__container">
        <div className="app-header__brand">
          <span className="app-header__symbol" aria-hidden="true">
            EC
          </span>

          <span className="app-header__name">
            Examen de Contabilidad
          </span>
        </div>

        <div className="app-header__actions">
          <span className="app-header__email" title={email}>
            {email}
          </span>

          <Button
            className="app-header__logout"
            type="button"
            onClick={onLogout}
            loading={loggingOut}
            loadingLabel="Cerrando..."
          >
            Cerrar sesión
          </Button>
        </div>
      </div>

      {error && (
        <p className="app-header__error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}
