/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Temporarily ignore TS errors to diagnose build failures
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors to diagnose build failures
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Increase server body size limit for audio file uploads (50MB)
    serverBodySizeLimit: "55mb",
  },
};
module.exports = nextConfig;
