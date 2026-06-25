// next.js config

const securityHeaders = [
  // no MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // no iframe embedding from other origins
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // legacy XSS filter
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // limit referrer to same origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()",
  },
  // force HTTPS for 1 year
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable instrumentation.ts for startup env-var assertions (required in Next.js 14)
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("bullmq");
    }
    // Silence "Module not found: Can't resolve 'crypto'" from firebase-admin/GCS
    // on the client bundle. These modules are server-only — the client never uses them.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        assert: false,
        url: false,
        net: false,
        tls: false,
        fs: false,
        zlib: false,
        http: false,
        https: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;

