import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authMethods, currentUser } from "../../../lib/server/auth";
import { safeNext } from "../../../lib/safe-next";
import { SignInForm } from "../../_components/account/AuthForms";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false },
  alternates: { canonical: "/ingresar" },
};

const ERRORS: Record<string, string> = {
  enlace: "El enlace para entrar venció o ya se usó. Pide uno nuevo.",
  google: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await currentUser()) redirect(next);
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Inicia sesión</h1>
        <p className="auth-sub">Entra a tu cuenta de Renglón para ver tu plan y tus descargas.</p>
        <SignInForm methods={authMethods()} next={next} initialError={error ? (ERRORS[error] ?? ERRORS.google) : undefined} />
      </div>
    </main>
  );
}
