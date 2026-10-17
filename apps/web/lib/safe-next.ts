/** Solo rutas internas: evita redirecciones abiertas con ?next=. */
export function safeNext(next: string | undefined | null, fallback = "/cuenta"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}
