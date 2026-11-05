import { useState, type FormEvent } from "react";
import { login, type AuthUser } from "../../api/auth.api";
import { ApiError, errorMessage } from "../../api/client";
import "./LoginPage.scss";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (error) {
      setError(errorMessage(error));
      if (error instanceof ApiError && error.status === 401) setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <section className="login__panel login__panel--form">
        <div className="login__form-wrapper">
          <span className="login__tag">Acceso</span>

          <h1 className="login__title">Examen de Contabilidad</h1>

          <p className="login__subtitle">
            Inicia sesión con tus credenciales para presentar tu examen o consultar tu resultado.
          </p>

          <form className="login__form" onSubmit={handleSubmit} aria-busy={loading}>
            <div className="login__field">
              <label className="login__label" htmlFor="email">
                Correo electrónico
              </label>

              <input
                className="login__input"
                id="email"
                type="email"
                autoComplete="username"
                placeholder="alumno@ejemplo.com"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(""); }}
                disabled={loading}
                maxLength={255}
                required
              />
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="password">
                Contraseña
              </label>

              <input
                className="login__input"
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                disabled={loading}
                maxLength={128}
                required
              />
            </div>

            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}

            <button
              className="login__button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </section>

      <section className="login__panel login__panel--content">
        <div className="login__content">
          <span className="login__content-tag">Muestra práctica</span>

          <h2 className="login__content-title">
            Puesto de Diseñador Programador
          </h2>

          <p className="login__content-text">
            Una aplicación para responder, evaluar y consultar resultados.
          </p>

          <p className="login__content-note">Examen de Contabilidad</p>
        </div>
      </section>
    </main>
  );
}