import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  ...(process.env.CI || process.env.PLAYWRIGHT ? { devIndicators: { buildActivity: false } } : {}),
  serverExternalPackages: ["pg", "exceljs", "@react-pdf/renderer"],
  transpilePackages: ["maplibre-gl"],
  // A package-lock.json under C:\Users\<you>\ makes Next pick the wrong workspace
  // root, which can make dev extremely slow or appear to hang on first load.
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.startlineau.com", pathname: "/uploads/**" },
      { protocol: "https", hostname: "*.cloudfront.net", pathname: "/uploads/**" },
      { protocol: "https", hostname: "*.s3.ap-southeast-2.amazonaws.com", pathname: "/uploads/**" },
      { protocol: "http", hostname: "localhost", port: "3000", pathname: "/uploads/**" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com",
              "connect-src 'self' https://js.stripe.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://cognito-idp.ap-southeast-2.amazonaws.com",
              "img-src 'self' data: blob: https://*.tiles.mapbox.com https://api.mapbox.com https:",
              "worker-src blob: 'self'",
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
              "font-src 'self' data: https://api.mapbox.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
