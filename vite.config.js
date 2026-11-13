import { defineConfig } from 'vite';

export default defineConfig({
  // 相对 base：本地开发、GitHub Pages 项目站（/<仓库名>/）用同一份构建产物；
  // 将来绑定独立域名时无需改动，保持 './' 即可
  base: './',
  publicDir: 'public',
  server: {
    port: 8000,
    open: true
  }
});