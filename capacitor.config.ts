import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:   "com.usebanger.app",
  appName: "BANGER",
  // Local shell required by Capacitor; the app itself loads server.url below
  webDir:  "native-shell",

  server: {
    url:       "https://usebanger.com",
    cleartext: false,
  },

  ios: {
    allowsLinkPreview: false,
    scrollEnabled:     false,
    contentInset:      "automatic",
    backgroundColor:   "#000000",
  },

  android: {
    backgroundColor: "#000000",
    allowMixedContent: false,
  },

  plugins: {
    Haptics: {},
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
