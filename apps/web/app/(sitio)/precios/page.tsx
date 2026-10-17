import type { Metadata } from "next";
import { Check } from "lucide-react";
import { formatCop, type PaidPlanId } from "../../../lib/plans";
import { currentUser } from "../../../lib/server/auth";
import { freeLimits, prices, wompiConfig } from "../../../lib/server/config";
import { BuyButton } from "../../_components/account/BuyButton";

export const metadata: Metadata = {
  title: "Precios",
  description:
    "Renglón es gratis para correcciones rápidas. Con el pase semanal o Pro descargas sin límites y sin anuncios. Paga con tarjeta, PSE o Nequi a través de Wompi.",
  alternates: { canonical: "/precios" },
};

// Los precios y las llaves de Wompi se leen del entorno en cada petición.
export const dynamic = "force-dynamic";

interface Card {
  id: PaidPlanId;
  name: string;
  price: number;
  period: string;
  note: string;
  cta: string;
  featured?: boolean;
}

export default async function PricingPage() {
  const p = prices();
  const free = freeLimits();
  const wompi = wompiConfig();
  const user = await currentUser().catch(() => null);
  const yearlySaving = Math.round((1 - p.pro_yearly / (p.pro_monthly * 12)) * 100);

  const paid: Card[] = [
    { id: "weekly", name: "Pase semanal", price: p.weekly, period: "por 7 días", note: "Para un trámite puntual.", cta: "Comprar el pase" },
    {
      id: "pro_monthly",
      name: "Pro mensual",
      price: p.pro_monthly,
      period: "por 30 días",
      note: "Si corriges PDF cada semana.",
      cta: "Pasarme a Pro",
      featured: true,
    },
    {
      id: "pro_yearly",
      name: "Pro anual",
      price: p.pro_yearly,
      period: "por 365 días",
      note: yearlySaving > 0 ? `Ahorras ${yearlySaving} % frente a 12 meses.` : "Un solo pago al año.",
      cta: "Comprar un año",
    },
  ];
  const paidPerks = ["Descargas sin límite", "Documentos de cualquier número de páginas", "Sin anuncios en todo el sitio", "Las mismas funciones del editor"];

  return (
    <main className="page-wrap pricing">
      <header className="page-head">
        <h1>Precios</h1>
        <p>
          Corregir un PDF de vez en cuando es gratis. Si lo haces seguido, un plan pago quita los límites y los anuncios. En
          todos los planes tu archivo se procesa en tu navegador y nunca se sube.
        </p>
      </header>

      {wompi?.sandbox && (
        <p className="banner info" role="note">
          <span>
            <strong>Modo de pruebas.</strong> Los pagos van al entorno de pruebas de Wompi y no cobran dinero real. Usa la
            tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC de 3 dígitos.
          </span>
        </p>
      )}

      <div className="plans">
        <section className="plan" id="free">
          <h2>Gratis</h2>
          <p className="plan-price">
            {formatCop(0)}
            <span>siempre</span>
          </p>
          <p className="plan-note">Para una corrección rápida.</p>
          <ul>
            <li>
              <Check size={16} aria-hidden />
              {free.dailyDownloads} descargas al día
            </li>
            {free.dailyPages > 0 && (
              <li>
                <Check size={16} aria-hidden />
                Hasta {free.dailyPages} páginas al día
              </li>
            )}
            <li>
              <Check size={16} aria-hidden />
              Todas las funciones del editor
            </li>
            <li>
              <Check size={16} aria-hidden />
              Con anuncios en las páginas informativas
            </li>
          </ul>
          <a className="btn lg block" href="/editar-pdf">
            Abrir el editor
          </a>
        </section>

        {paid.map((plan) => (
          <section className={`plan ${plan.featured ? "featured" : ""}`} id={plan.id} key={plan.id}>
            {plan.featured && <span className="plan-flag">El más elegido</span>}
            <h2>{plan.name}</h2>
            <p className="plan-price">
              {formatCop(plan.price)}
              <span>{plan.period}</span>
            </p>
            <p className="plan-note">{plan.note}</p>
            <ul>
              {paidPerks.map((perk) => (
                <li key={perk}>
                  <Check size={16} aria-hidden />
                  {perk}
                </li>
              ))}
            </ul>
            <BuyButton plan={plan.id} label={plan.cta} loggedIn={!!user} available={!!wompi} primary={plan.featured} />
          </section>
        ))}
      </div>

      <section className="pricing-faq">
        <h2>Preguntas sobre los pagos</h2>
        <dl>
          <div>
            <dt>¿Se renueva solo?</dt>
            <dd>
              No. Cada plan es un pago único por el tiempo que elijas. Te avisamos antes de que venza y, si renuevas antes,
              el tiempo nuevo se suma al que te queda.
            </dd>
          </div>
          <div>
            <dt>¿Cómo pago?</dt>
            <dd>
              Con Wompi, la pasarela de Bancolombia: tarjeta de crédito o débito, PSE, Nequi o botón Bancolombia. Renglón
              no ve ni guarda los datos de tu tarjeta.
            </dd>
          </div>
          <div>
            <dt>¿Necesito una cuenta?</dt>
            <dd>
              Para el plan gratis no. Para comprar un plan sí, porque así lo usas en cualquier navegador donde inicies
              sesión.
            </dd>
          </div>
          <div>
            <dt>¿Qué pasa cuando vence?</dt>
            <dd>Vuelves al plan gratis. No pierdes nada: tus documentos nunca estuvieron en nuestros servidores.</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
