import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 配置 Turbopack 处理 Excalidraw CSS
  transpilePackages: ["@excalidraw/excalidraw"],
};

export default nextConfig;
