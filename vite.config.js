import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// ???DESIGN Vite ???
// ??????:??? 11422 / ??? 18766(????????5176/18765 ?????51xx ???)
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
            // ??? API ?g?
            '/api': {
                target: 'http://127.0.0.1:18766',
                changeOrigin: true,
            },
            // ?????????'???
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
        __APP_VERSION__: JSON.stringify('3.0.7'),
        __APP_NAME__: JSON.stringify('??DESIGN'),
    },
});
