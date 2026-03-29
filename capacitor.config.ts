import type { CapacitorConfig } from '@capacitor/cli';

// Troque pela URL do seu deploy no Vercel depois de publicar
const PRODUCTION_URL = 'https://SEU-PROJETO.vercel.app';

// Para testes locais: coloque o IP da sua máquina na rede local
// Descubra com: ipconfig (Windows) | ip addr (Linux)
const DEV_URL = 'http://192.168.3.13:3000'; // ← troque pelo seu IP

const isProd = process.env.CAP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.giro.app',
  appName: 'Giro',
  webDir: 'out', // pasta fallback (não usada com server.url)
  server: {
    url: isProd ? PRODUCTION_URL : DEV_URL,
    cleartext: true, // permite HTTP no dev; HTTPS em prod já é seguro
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true, // necessário para dev com HTTP
  },
};

export default config;