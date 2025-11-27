import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega les variables d'entorn (com API_KEY) de Netlify o .env
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Això permet que el codi "process.env.API_KEY" funcioni al navegador
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Fix per algunes llibreries antigues
      'process.env': {}
    }
  };
});