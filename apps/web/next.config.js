/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  output: 'standalone',
  async rewrites() {
    // Proxy /v1/* to the API server so NEXT_PUBLIC_API_URL can be relative ('').
    // API_URL is server-side only (not NEXT_PUBLIC_), resolved at runtime by Next.js server.
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    return [
      {
        source: '/v1/:path*',
        destination: `${apiUrl}/v1/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${apiUrl}/storage/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
