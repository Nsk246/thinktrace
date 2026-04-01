/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
  // Forward all status codes including 4xx and 5xx through the proxy
  experimental: {
    proxyTimeout: 120000,
  },
};
module.exports = nextConfig;
