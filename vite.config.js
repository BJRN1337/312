import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base: '/' när appen ligger på root (egen domän, t.ex. 312.stormyran.se)
  // base: '/312/' för GitHub Pages-deploy under bjrn1337.github.io
  base: '/312/',
})
