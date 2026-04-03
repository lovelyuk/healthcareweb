import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // API routes only — no React pages in this project yet
  // The existing static HTML frontend is served separately.
  // When migrating HTML pages to Next.js, add them here.
  reactStrictMode: true,

  // Vercel Edge or Node.js runtime — use Node for API routes that need file system
  // (In-memory store, Turso libSQL client)
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
