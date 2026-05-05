/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

module.exports = nextConfig;
