import type { Metadata } from "next";
import { ResetPasswordForm } from "../../_components/account/AuthForms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Elige una contraseña nueva</h1>
        {token && !error ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <p className="notice error" role="alert">
              El enlace venció o ya se usó.
            </p>
            <a className="btn primary lg block" href="/recuperar">
              Pedir un enlace nuevo
            </a>
          </>
        )}
      </div>
    </main>
  );
}
