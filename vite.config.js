import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // === НОВЫЕ НАСТРОЙКИ ДЛЯ TAURI ===
  // Предотвращает очистку консоли Vite, чтобы не скрыть ошибки Tauri
  clearScreen: false,
  // Заставляет Vite использовать именно этот порт (иначе Tauri его не найдет)
  server: {
    port: 5173,
    strictPort: true,
  },
  // Настройки среды, чтобы Tauri понимал, что он собирает
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri поддерживает современные браузеры, так что можно ускорить сборку
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Не минифицируем код для дебага, если нужно
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Выключаем карты кода для релизного билда
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})