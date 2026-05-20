/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // MVP'de saat görsellerini herhangi bir CDN'den / S3'ten alabiliyoruz.
    // Production'da burayı kısıtlayacağız.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
