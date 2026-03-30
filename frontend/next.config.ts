/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'https://refactored-space-umbrella-rw5x57rwj692676-8000.app.github.dev/api/v1/:path*',
      },
    ];
  },
  // Forward all status codes including 4xx and 5xx through the proxy
  experimental: {
    proxyTimeout: 120000,
  },
};
module.exports = nextConfig;
