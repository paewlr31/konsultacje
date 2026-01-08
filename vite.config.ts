// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,          // umożliwia dostęp z sieci (0.0.0.0)
    port: 5173,          // opcjonalnie, możesz zostawić jak jest
  }
})
