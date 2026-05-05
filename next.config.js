/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // Trim unused locales from the bundle
  i18n: undefined,
  // Strict mode catches issues early without affecting bundle size
  reactStrictMode: true,
};

module.exports = nextConfig;
