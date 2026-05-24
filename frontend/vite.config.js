import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Plugin: stamps public/version.json on every build so the app can
// detect new deploys and prompt users to refresh.
const versionStampPlugin = {
  name: 'version-stamp',
  buildStart() {
    const buildId = Date.now().toString(36); // short base-36 id
    const payload = JSON.stringify({
      version: buildId,
      buildTime: new Date().toISOString()
    });
    writeFileSync(resolve(__dirname, 'public/version.json'), payload);
    console.log(`[version-stamp] Build ID: ${buildId}`);
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionStampPlugin],
  server: {
    allowedHosts: ['westlin-engineeringly-thresa.ngrok-free.dev', '.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

