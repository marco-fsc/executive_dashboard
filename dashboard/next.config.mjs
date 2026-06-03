/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js webpack from bundling these packages — they contain
  // native binaries that must be loaded at runtime, not bundled.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
};

export default nextConfig;
