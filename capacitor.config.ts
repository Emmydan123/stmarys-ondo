import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stmarys.ondo',
  appName: "St. Mary's Anglican Church, Ondo",
  webDir: 'www',
  server: {
    url: 'https://stmarys-ondo.onrender.com',
    cleartext: false
  }
};

export default config;
