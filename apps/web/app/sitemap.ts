import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { GUIDES } from "./(sitio)/guias/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/editar-pdf", "/guias", "/privacidad", "/terminos"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : path === "/editar-pdf" ? 0.9 : 0.5,
  }));
  const guides = GUIDES.map((g) => ({
    url: `${SITE_URL}/guias/${g.slug}`,
    lastModified: g.updated,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [...pages, ...guides];
}
