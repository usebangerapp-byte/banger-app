/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://172.20.10.3:3000",
    "http://172.20.10.10:3000",
  ],
};

module.exports = nextConfig;

