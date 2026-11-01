import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fantachat.app",
  appName: "FantaChat",
  webDir: "public",
  server: {
    url: "https://fantachat-app.vercel.app",
    cleartext: false,
  },
};

export default config;
