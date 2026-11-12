/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/catalog", destination: "/catalog/products", permanent: false },
      { source: "/seo-triage", destination: "/catalog/seo", permanent: false },
      { source: "/seo-tools", destination: "/catalog/seo/tools", permanent: false },
      { source: "/seller-store", destination: "/catalog/seo/preview", permanent: false },
      { source: "/repricer", destination: "/catalog/pricing", permanent: false },
      { source: "/inventory", destination: "/supply/inventory", permanent: false },
      { source: "/approvals", destination: "/supply/purchasing?tab=approvals", permanent: false },
      { source: "/ppc", destination: "/marketing/ppc", permanent: false },
      { source: "/activity", destination: "/admin/audit", permanent: false },
      { source: "/how", destination: "/admin/help", permanent: false },
      { source: "/sourcing", destination: "/catalog/seo/preview", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: https:; " +
              "connect-src 'self'; " +
              "font-src 'self'; " +
              "object-src 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
