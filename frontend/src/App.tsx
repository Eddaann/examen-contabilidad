import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "./api/client";
import LoginPage from "./pages/LoginPage/LoginPage";
import { getCurrentUser, logout, type AuthUser } from "./api/auth.api";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [sessionCheck, setSessionCheck] = useState(0);

  useEffect(() => {
    let active = true;
    setCheckingSession(true);
    setSessionError("");

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
        } else {
          setSessionError(errorMessage(error));
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => { active = false; };
  }, [sessionCheck]);


  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      setUser(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      } else {
        setLogoutError(errorMessage(error));
      }
    } finally {
      setLoggingOut(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="app-error" role="status" aria-live="polite">
        <p>Comprobando tu sesión...</p>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="app-error" role="alert">
        <h1>No pudimos comprobar tu sesión</h1>
        <p>{sessionError}</p>
        <button type="button" onClick={() => setSessionCheck((attempt) => attempt + 1)}>
          Reintentar
        </button>
      </main>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <main>
      <h1>Bienvenido</h1>
      <p>{user.email}</p>
      <button type="button" onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
      </button>
      {logoutError && <p role="alert">{logoutError}</p>}
    </main>
  );
}
