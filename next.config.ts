import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  onDemandEntries: {
    maxInactiveAge: 0,
  },
  allowedDevOrigins: [
    "preview-chat-3320097f-4523-4c3e-9e9e-a56b3f478eca.space.z.ai",
  ],
};

export default nextConfig;
