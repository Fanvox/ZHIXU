/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mammoth", "unpdf"],
  eslint: {
    // 构建时跳过 ESLint（`pnpm lint` 仍可单独运行）
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
