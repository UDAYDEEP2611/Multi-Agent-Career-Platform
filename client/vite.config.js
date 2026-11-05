import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The GitHub Pages demo runs the server's job matching in the browser, without
// its PDF and Word readers
const demoAliases = process.env.VITE_STATIC_SITE === 'true'
  ? { 'pdf-parse': new URL('./src/demo/emptyModule.js', import.meta.url).pathname, jszip: new URL('./src/demo/emptyModule.js', import.meta.url).pathname }
  : {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: demoAliases },
})
