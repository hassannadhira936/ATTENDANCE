import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://localhost:8080'

// Optional LOCAL HTTPS (needed for fingerprint on phones).
// Put mkcert files in  Biometric-attendance-frontend/certs/  named  cert.pem  and  key.pem
// (see HTTPS-FINGERPRINT-SIMU.md). If they do not exist, Vite runs on plain http as before.
const certFile = 'certs/cert.pem'
const keyFile = 'certs/key.pem'
const https =
  fs.existsSync(certFile) && fs.existsSync(keyFile)
    ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    https,
    allowedHosts: true, // allow ngrok / cloudflared / sslip.io host names
    // Page is served over https, so the browser talks ONLY to Vite (same origin);
    // Vite forwards backend calls to Spring Boot over plain http on this PC.
    proxy: {
      '/api': backend,
      '/uploads': backend,
      '/webauthn': backend,
      '/login/webauthn': backend,
    },
  },
})
