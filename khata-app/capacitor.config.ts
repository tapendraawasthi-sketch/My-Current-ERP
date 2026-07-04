import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sutraerp.khata",
  appName: "Mobile Khata",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#1a56db",
    },
  },
};

export default config;
