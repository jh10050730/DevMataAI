import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // /api 요청은 NestJS 서버로 전달 (CORS 없이 동작)
    proxy: { '/api': 'http://localhost:3000' },
  },
});
