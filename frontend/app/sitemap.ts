import type { MetadataRoute } from "next";

/**
 * /sitemap.xml — Next.js 13+ konvansiyonu.
 *
 * Statik sayfaları tek tek listeler ve priority değerleriyle Google'a
 * hangisinin "homepage" olduğunu net söyleriz. Ana sayfa priority=1.0,
 * gezinme sayfaları 0.8, kurumsal/açıklama sayfaları 0.5.
 *
 * Dinamik liste (açık saatler, müzayedeler) burada hâlâ statik referans olarak
 * geçer çünkü gerçek detay URL'ler ($baseUrl/auctions/{id}) Google tarafından
 * sayfa içi linkler ile keşfedilir.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://miyaris.com";
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${base}/auctions`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/sell-watch`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${base}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/authentication`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
