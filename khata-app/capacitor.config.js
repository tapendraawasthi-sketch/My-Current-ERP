"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config = {
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
exports.default = config;
