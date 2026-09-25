/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'canvas', '@napi-rs/canvas'],
};

module.exports = nextConfig;
