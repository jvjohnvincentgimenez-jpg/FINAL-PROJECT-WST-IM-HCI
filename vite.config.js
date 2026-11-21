import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import assistantHandler from './api/assistant.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY

  return {
    plugins: [
      react(),
      {
        name: 'local-assistant-api',
        configureServer(server) {
          server.middlewares.use('/api/assistant', assistantHandler)
        },
      },
    ],
  }
})
