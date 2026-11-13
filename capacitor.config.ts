import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.solucionesmoviles.maestropersonal",
  appName: "Maestro de Personal",
  webDir: "dist",
  backgroundColor: "#ffffff",
  android: {
    allowMixedContent: false,
  },
};

export default config;
