import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * 站点构建配置。
 * - 本地开发固定 7777 端口，端口被占用时直接失败，避免误连到别的服务。
 * - 资源不依赖任何 CDN，字体全部使用系统字体栈，离线可跑。
 */
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 7777,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 7777,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 640,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
}));
