import { useEffect, useRef, useState, type FormEvent } from "react";
import { login, register, type AuthUser } from "../../api/auth.api";
import { ApiError, errorMessage } from "../../api/client";
import Button from "../../components/Button";
import "./LoginPage.scss";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousMode = useRef(registering);

  useEffect(() => {
    if (previousMode.current !== registering) titleRef.current?.focus();
    previousMode.current = registering;
  }, [registering]);

  function switchMode() {
    setRegistering((value) => !value);
    setPassword("");
    setConfirmation("");
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    if (registering && password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);

    try {
      if (registering) {
        const user = await register(email.trim(), password);
        setEmail(user.email);
        setPassword("");
        setConfirmation("");
        setRegistering(false);
        setNotice("Cuenta creada correctamente. Inicia sesión con tu correo y contraseña.");
      } else {
        const user = await login(email.trim(), password);
        onLogin(user);
      }
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
          <span className="login__tag">{registering ? "Registro de estudiante" : "Acceso"}</span>

          <h1 ref={titleRef} tabIndex={-1} className="login__title">{registering ? "Crea tu cuenta" : "Examen de Contabilidad"}</h1>

          <p className="login__subtitle">
            {registering
              ? "Regístrate como estudiante para presentar tu examen y consultar tu resultado."
              : "Inicia sesión con tus credenciales para presentar tu examen o consultar tu resultado."}
          </p>

          {notice && <p className="login__notice" role="status">{notice}</p>}
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
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                disabled={loading}
                maxLength={128}
                minLength={registering ? 12 : undefined}
                aria-describedby={registering ? "password-hint" : undefined}
                required
              />
              {registering && <small id="password-hint" className="login__hint">Entre 12 y 128 caracteres.</small>}
            </div>

            {registering && (
              <div className="login__field">
                <label className="login__label" htmlFor="password-confirmation">Confirmar contraseña</label>
                <input
                  className="login__input"
                  id="password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => { setConfirmation(event.target.value); setError(""); }}
                  disabled={loading}
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
            )}

            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}

            <Button
              className="login__button"
              type="submit"
              loading={loading}
              loadingLabel={registering ? "Creando cuenta..." : "Ingresando..."}
            >
              {registering ? "Crear cuenta" : "Iniciar sesión"}
            </Button>
          </form>
          <p className="login__switch">
            {registering ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
            <Button className="login__link" onClick={switchMode} disabled={loading}>
              {registering ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </p>
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
