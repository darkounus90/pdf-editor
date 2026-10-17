import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authMethods, currentUser } from "../../../lib/server/auth";
import { freeLimits } from "../../../lib/server/config";
import { safeNext } from "../../../lib/safe-next";
import { SignUpForm } from "../../_components/account/AuthForms";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta gratis en Renglón para guardar tu plan y descargar sin límites con Pro.",
  robots: { index: false },
  alternates: { canonical: "/registro" },
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  const free = freeLimits();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Crea tu cuenta</h1>
        <p className="auth-sub">
          Es gratis: {free.dailyDownloads} descargas al día. Con Pro descargas sin límites y sin anuncios. Tus PDF siguen
          sin salir de tu navegador.
        </p>
        <SignUpForm methods={authMethods()} next={next} />
      </div>
    </main>
  );
}
