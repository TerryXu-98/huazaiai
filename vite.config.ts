import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 鑺卞啀DESIGN Vite 閰嶇疆
// 绔彛绛栫暐:鍓嶇 11422 / 鍚庣 18766(閬垮紑涓婚」鐩?5176/18765 涓庡父瑙?51xx 鍗犵敤)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 11422,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      // 鍚庣 API 浠ｇ悊
      '/api': {
        target: 'http://127.0.0.1:18766',
        changeOrigin: true,
      },
      // 闈欐€佹枃浠舵湇鍔′唬鐞?
      '/files': {
        target: 'http://127.0.0.1:18766',
        changeOrigin: true,
      },
      '/output': {
        target: 'http://127.0.0.1:18766',
        changeOrigin: true,
      },
      '/input': {
        target: 'http://127.0.0.1:18766',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'xyflow': ['@xyflow/react'],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('3.0.8'),
    __APP_NAME__: JSON.stringify('花再DESIGN'),
  },
});

