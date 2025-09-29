/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Fix output tracing root warning
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;