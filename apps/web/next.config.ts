import type { NextConfig } from "next";

// Cross-package strategy: @even/* workspace packages are consumed as BUILT
// dist (main/types -> dist; see root README "Workspace layout"), so no
// transpilePackages is configured here. Run `pnpm build` (or `pnpm predev`)
// after changing packages/*.

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next dev/HMR and inline font bootstrapping
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
  "font-src 'self' https://cdn.fontshare.com https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' ws: wss:", // ws/wss: dev HMR
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
