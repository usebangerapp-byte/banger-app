import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.usebanger.app',
  appName: 'Banger',
  webDir: 'out',
  server: {
    url: 'http://172.20.10.10:3000',
    cleartext: true
  }
};

export default config;
