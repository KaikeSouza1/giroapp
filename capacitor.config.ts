import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.giro.app',
  appName: 'Giro',
  webDir: 'out',
  server: {
    // Apontando direto pro seu Vercel para garantir que o app ache o servidor!
    url: 'https://giroapp.vercel.app', 
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;