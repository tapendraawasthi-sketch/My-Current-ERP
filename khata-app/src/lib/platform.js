"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNativePlatform = isNativePlatform;
exports.getPlatform = getPlatform;
var core_1 = require("@capacitor/core");
function isNativePlatform() {
    return core_1.Capacitor.isNativePlatform();
}
function getPlatform() {
    return core_1.Capacitor.getPlatform();
}
