const path = require("path");
const { loadEnvConfig } = require("@next/env");
const withNextIntl = require("next-intl/plugin")("./src/i18n/request.ts");

// Monorepo : charger aussi le .env à la racine (fallback), puis apps/admin-platform/.env.local
loadEnvConfig(path.join(__dirname, "../.."));
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

module.exports = withNextIntl(nextConfig);
