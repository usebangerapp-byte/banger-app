import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:   "com.usebanger.app",
  appName: "BANGER",
  webDir:  "out",

  server: {
    url:       "https://banger-app-zeta.vercel.app",
    cleartext: false,
  },

  ios: {
    allowsLinkPreview: false,
    scrollEnabled:     false,
    contentInset:      "automatic",
    backgroundColor:   "#000000",
  },

  plugins: {
    Haptics: {},
  },
};

export default config;
