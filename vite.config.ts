/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      // src/lib은 mobile/과 공유한다. 두 앱의 supabase 클라이언트가 서로 달라서
      // (환경변수 읽는 법·세션 저장소) 이 이름으로 갈라 끼운다.
      '@db': fileURLToPath(new URL('./src/lib/supabase.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
