/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Shared cPanel accounts can terminate parallel Next.js build workers for
    // exceeding their per-account memory limit. One worker is slower but stable.
    cpus: 1
  },
  // The shared cPanel build environment has a very small process-memory limit.
  // Type checking continues in normal development/CI builds; it is skipped only
  // when the cPanel deployment command explicitly enables this flag.
  typescript: {
    ignoreBuildErrors: process.env.CPANEL_BUILD === "1"
  },
  turbopack: {
    root: __dirname
  },
  images: {
    formats: ["image/avif", "image/webp"],

    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com"
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com"
      },
      {
        protocol: "https",
        hostname: "**.supabase.co"
      },
      {
        protocol: "https",
        hostname: "i.ibb.co"
      },
      {
        protocol: "https",
        hostname: "ibb.co"
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
