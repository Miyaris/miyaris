import type { MetadataRoute } from "next";

/**
 * /robots.txt — Next.js 13+ konvansiyonu.
 *
 * Tüm public sayfaları indexlenebilir bırakırız. Admin ve account altı
 * kullanıcıya özel; index dışı tutarız. Sitemap referansı Google'a hangi
 * URL'leri ne öncelikle tarayacağını anlatır.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/api/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: "https://miyaris.com/sitemap.xml",
    host: "https://miyaris.com",
  };
}
