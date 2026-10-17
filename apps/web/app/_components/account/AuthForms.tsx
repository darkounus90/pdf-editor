"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "../../../lib/auth-client";

export interface Methods {
  magicLink: boolean;
  passwordReset: boolean;
  google: boolean;
}

type AuthError = { status?: number; code?: string; message?: string } | null | undefined;

function errorText(err: AuthError): string {
  if (!err) return "Algo salió mal. Inténtalo de nuevo.";
  if (err.status === 429) return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "El correo o la contraseña no coinciden.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya existe una cuenta con ese correo. Inicia sesión.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "La contraseña es demasiado larga.";
    case "INVALID_EMAIL":
      return "Escribe un correo válido.";
    case "INVALID_TOKEN":
      return "El enlace venció o ya se usó. Pide uno nuevo.";
    case "INVALID_PASSWORD":
      return "La contraseña no es correcta.";
    default:
      return "No pudimos completar la solicitud. Inténtalo de nuevo.";
  }
}

function Field(props: { label: string; name: string; type?: string; autoComplete?: string; minLength?: number; hint?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        minLength={props.minLength}
        maxLength={props.type === "password" ? 128 : 200}
        required
      />
      {props.hint && <small>{props.hint}</small>}
    </label>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (fn: (data: FormData) => Promise<void>) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn(new FormData(e.currentTarget));
    } catch (err) {
      setError(err instanceof Error ? err.message : errorText(null));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, done, setDone, run };
}

function Notice({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  return (
    <p className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

function GoogleButton({ next }: { next: string }) {
  return (
    <button
      type="button"
      className="btn lg block"
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/ingresar?error=google" })}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continuar con Google
    </button>
  );
}

function Divider() {
  return (
    <div className="divider" role="separator">
      <span>o</span>
    </div>
  );
}

export function SignInForm({ methods, next, initialError }: { methods: Methods; next: string; initialError?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const { busy, error, done, setDone, run } = useSubmit();

  const onPassword = run(async (data) => {
    const { error } = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
    if (error) throw new Error(errorText(error));
    window.location.assign(next);
  });

  const onMagic = run(async (data) => {
    const { error } = await authClient.signIn.magicLink({
      email: String(data.get("email")),
      callbackURL: next,
      errorCallbackURL: "/ingresar?error=enlace",
    });
    if (error) throw new Error(errorText(error));
    setDone("Te enviamos un enlace para entrar. Revisa tu correo (y la carpeta de spam). Vence en 15 minutos.");
  });

  return (
    <div className="auth-stack">
      {initialError && <Notice kind="error">{initialError}</Notice>}
      {methods.google && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      {done ? (
        <Notice kind="ok">{done}</Notice>
      ) : mode === "password" ? (
        <form className="auth-form" onSubmit={onPassword}>
          <Field label="Correo" name="email" type="email" autoComplete="email" />
          <Field label="Contraseña" name="password" type="password" autoComplete="current-password" />
          {error && <Notice kind="error">{error}</Notice>}
          <button className="btn primary lg block" disabled={busy}>
            {busy ? "Entrando…" : "Iniciar sesión"}
          </button>
          <div className="auth-links">
            {methods.passwordReset && <a href="/recuperar">¿Olvidaste tu contraseña?</a>}
            {methods.magicLink && (
              <button type="button" className="link-btn" onClick={() => setMode("magic")}>
                Entrar con un enlace por correo
              </button>
            )}
          </div>
        </form>
      ) : (
        <form className="auth-form" onSubmit={onMagic}>
          <Field label="Correo" name="email" type="email" autoComplete="email" hint="Te enviaremos un enlace para entrar sin contraseña." />
          {error && <Notice kind="error">{error}</Notice>}
          <button className="btn primary lg block" disabled={busy}>
            {busy ? "Enviando…" : "Enviarme el enlace"}
          </button>
          <div className="auth-links">
            <button type="button" className="link-btn" onClick={() => setMode("password")}>
              Usar mi contraseña
            </button>
          </div>
        </form>
      )}
      <p className="auth-switch">
        ¿No tienes cuenta? <a href={`/registro${next !== "/cuenta" ? `?next=${encodeURIComponent(next)}` : ""}`}>Créala gratis</a>
      </p>
    </div>
  );
}

export function SignUpForm({ methods, next }: { methods: Methods; next: string }) {
  const { busy, error, run } = useSubmit();

  const onSubmit = run(async (data) => {
    const { error } = await authClient.signUp.email({
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      password: String(data.get("password")),
    });
    if (error) throw new Error(errorText(error));
    window.location.assign(next);
  });

  return (
    <div className="auth-stack">
      {methods.google && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      <form className="auth-form" onSubmit={onSubmit}>
        <Field label="Nombre" name="name" autoComplete="name" />
        <Field label="Correo" name="email" type="email" autoComplete="email" />
        <Field label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={8} hint="Mínimo 8 caracteres." />
        {error && <Notice kind="error">{error}</Notice>}
        <button className="btn primary lg block" disabled={busy}>
          {busy ? "Creando tu cuenta…" : "Crear cuenta"}
        </button>
        <p className="auth-legal">
          Al crear la cuenta aceptas los <a href="/terminos">Términos</a> y la <a href="/privacidad">Política de privacidad</a>.
        </p>
      </form>
      <p className="auth-switch">
        ¿Ya tienes cuenta? <a href={`/ingresar${next !== "/cuenta" ? `?next=${encodeURIComponent(next)}` : ""}`}>Inicia sesión</a>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const { busy, error, done, setDone, run } = useSubmit();
  const onSubmit = run(async (data) => {
    const { error } = await authClient.requestPasswordReset({ email: String(data.get("email")).trim(), redirectTo: "/restablecer" });
    if (error) throw new Error(errorText(error));
    setDone("Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva. Vence en una hora.");
  });
  if (done) return <Notice kind="ok">{done}</Notice>;
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <Field label="Correo de tu cuenta" name="email" type="email" autoComplete="email" />
      {error && <Notice kind="error">{error}</Notice>}
      <button className="btn primary lg block" disabled={busy}>
        {busy ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { busy, error, done, setDone, run } = useSubmit();
  const onSubmit = run(async (data) => {
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) throw new Error("Las contraseñas no coinciden.");
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) throw new Error(errorText(error));
    setDone("Listo: tu contraseña cambió. Ya puedes iniciar sesión.");
  });
  if (done)
    return (
      <div className="auth-stack">
        <Notice kind="ok">{done}</Notice>
        <a className="btn primary lg block" href="/ingresar">
          Iniciar sesión
        </a>
      </div>
    );
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <Field label="Contraseña nueva" name="password" type="password" autoComplete="new-password" minLength={8} hint="Mínimo 8 caracteres." />
      <Field label="Repite la contraseña" name="confirm" type="password" autoComplete="new-password" minLength={8} />
      {error && <Notice kind="error">{error}</Notice>}
      <button className="btn primary lg block" disabled={busy}>
        {busy ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await authClient.signOut();
        if (error) {
          setBusy(false);
          window.alert("No se pudo cerrar la sesión. Recarga la página e inténtalo de nuevo.");
          return;
        }
        window.location.assign("/");
      }}
    >
      Cerrar sesión
    </button>
  );
}

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const onSubmit = run(async (data) => {
    const { error } = await authClient.deleteUser(hasPassword ? { password: String(data.get("password")) } : {});
    if (error) {
      if (error.code === "SESSION_EXPIRED") throw new Error("Por seguridad, cierra sesión, vuelve a entrar e inténtalo otra vez.");
      throw new Error(errorText(error));
    }
    window.location.assign("/");
  });
  if (!open)
    return (
      <button className="btn danger-link" onClick={() => setOpen(true)}>
        Eliminar mi cuenta
      </button>
    );
  return (
    <form className="auth-form danger-box" onSubmit={onSubmit}>
      <p>
        Se borran tu cuenta, tus sesiones y tu plan. El tiempo pagado que te quede se pierde. Esta acción no se puede
        deshacer.
      </p>
      {hasPassword && <Field label="Escribe tu contraseña para confirmar" name="password" type="password" autoComplete="current-password" />}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button className="btn danger" disabled={busy}>
          {busy ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </form>
  );
}
