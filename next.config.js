/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase server body size limit for audio file uploads (50MB)
    serverBodySizeLimit: "55mb",
  },
};
module.exports = nextConfig;
