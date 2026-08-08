import type { NextConfig } from "next";

const securityHeaders = [
  // Force HTTPS for 2 years once deployed behind TLS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Add a Content-Security-Policy once your asset origins are settled, e.g.:
  // { key: "Content-Security-Policy", value: "default-src 'self'; ..." },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
