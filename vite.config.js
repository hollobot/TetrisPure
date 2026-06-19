import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// 部署到 GitHub Pages 等子路径时可改为 './'，纯根路径部署保持 '/'
export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    // PWA：仅做离线缓存（Service Worker 预缓存静态资源），不提供桌面安装能力。
    // 未配置 manifest 图标，浏览器不会触发安装提示，符合「离线游玩、不安装」的需求。
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,mp3,wav}"],
      },
    }),
  ],
  base: process.env.GITHUB_ACTIONS ? "/TetrisPure/" : "/",
});
