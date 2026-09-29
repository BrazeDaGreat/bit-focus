import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  experimental: {
    // Rewrite barrel imports to per-module imports so only the icons and
    // helpers actually used are bundled.
    optimizePackageImports: [
      "react-icons/fa",
      "react-icons/fa6",
      "react-icons/io",
      "react-icons/bs",
      "react-icons/gi",
      "react-icons/tb",
      "lucide-react",
      "date-fns",
      "recharts",
    ],
  },
  async redirects() {
    return [
      { source: "/account", destination: "/settings#account", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        port: "",
        pathname: "/**/*",
        search: "",
      },
    ],
  },
};

export default nextConfig;
