/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Render (non-Vercel) deployment: bundles a self-contained server
  output: "standalone",
};

export default nextConfig;
