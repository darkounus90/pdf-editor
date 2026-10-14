import type { ReactNode } from "react";

/** Marca de Renglón: tres renglones, uno corregido en rojo con su signo de inserción. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <rect x="7.5" y="9" width="17" height="2.6" rx="1.3" fill="#fff" />
      <rect x="7.5" y="14.7" width="10.5" height="2.6" rx="1.3" fill="var(--red-bright)" />
      <path
        d="M19.6 19.4 21.7 15l2.1 4.4"
        fill="none"
        stroke="var(--red-bright)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7.5" y="20.4" width="9" height="2.6" rx="1.3" fill="#fff" opacity=".55" />
    </svg>
  );
}

export function Brand({ href, children }: { href?: string; children?: ReactNode }) {
  const content = (
    <>
      <BrandMark />
      <span className="brand-word">renglón</span>
      {children}
    </>
  );
  return href ? (
    <a className="brand" href={href} aria-label="Renglón, ir al inicio">
      {content}
    </a>
  ) : (
    <div className="brand">{content}</div>
  );
}
