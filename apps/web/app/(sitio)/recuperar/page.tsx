import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authMethods } from "../../../lib/server/auth";
import { ForgotPasswordForm } from "../../_components/account/AuthForms";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

// Depende de SMTP_URL, que se lee al arrancar el servidor y no al compilar.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  if (!authMethods().passwordReset) notFound();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Recupera tu contraseña</h1>
        <p className="auth-sub">Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.</p>
        <ForgotPasswordForm />
        <p className="auth-switch">
          <a href="/ingresar">Volver a iniciar sesión</a>
        </p>
      </div>
    </main>
  );
}
