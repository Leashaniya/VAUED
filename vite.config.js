import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const readingsTarget = env.VITE_IOT_API_BASE_URL || 'http://127.0.0.1:4000'
  const readingsApiKey = env.VITE_IOT_API_KEY || 'my_secret_api_key_123'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/readings': {
          target: readingsTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              if (!proxyReq.getHeader('x-api-key')) {
                proxyReq.setHeader('X-API-Key', readingsApiKey)
              }
            })
          },
        },
      },
    },
  }
})
