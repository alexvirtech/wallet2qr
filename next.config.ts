import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://authjs.dev https://*.googleusercontent.com",
              "media-src 'self' blob:",
              "connect-src 'self' https://*.llamarpc.com https://*.infura.io https://*.alchemy.com https://*.publicnode.com https://api.coingecko.com https://li.quest https://*.lifi.tools https://api.mainnet-beta.solana.com https://*.solana.com https://accounts.google.com https://*.googleapis.com",
              "font-src 'self'",
              "worker-src 'self' blob:",
              "frame-src 'none'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
