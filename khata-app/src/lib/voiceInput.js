"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVoiceInputSupported = isVoiceInputSupported;
exports.listenOnce = listenOnce;
var platform_1 = require("./platform");
var nativeSpeechPlugin = null;
function getNativeSpeechPlugin() {
    return __awaiter(this, void 0, void 0, function () {
        var mod, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (nativeSpeechPlugin)
                        return [2 /*return*/, nativeSpeechPlugin];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@capacitor-community/speech-recognition"); })];
                case 2:
                    mod = _b.sent();
                    nativeSpeechPlugin = mod.SpeechRecognition;
                    return [2 /*return*/, nativeSpeechPlugin];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function isVoiceInputSupported() {
    if ((0, platform_1.isNativePlatform)())
        return true;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function listenOnce() {
    return __awaiter(this, arguments, void 0, function (lang) {
        if (lang === void 0) { lang = "ne-NP"; }
        return __generator(this, function (_a) {
            if ((0, platform_1.isNativePlatform)()) {
                return [2 /*return*/, listenNative(lang)];
            }
            return [2 /*return*/, listenWeb(lang)];
        });
    });
}
function listenNative(lang) {
    return __awaiter(this, void 0, void 0, function () {
        var plugin, permResult, available;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getNativeSpeechPlugin()];
                case 1:
                    plugin = _a.sent();
                    if (!plugin) {
                        throw new Error("Speech recognition plugin not available");
                    }
                    return [4 /*yield*/, plugin.requestPermissions()];
                case 2:
                    permResult = _a.sent();
                    if (permResult.speechRecognition !== "granted") {
                        throw new Error("Microphone permission denied");
                    }
                    return [4 /*yield*/, plugin.available()];
                case 3:
                    available = _a.sent();
                    if (!available.available) {
                        throw new Error("Speech recognition not available on this device");
                    }
                    return [2 /*return*/, new Promise(function (resolve, reject) {
                            var resolved = false;
                            plugin.addListener("partialResults", function (_data) {
                                // We wait for final results
                            });
                            plugin.addListener("listeningState", function (data) {
                                if (data.status === "stopped" && !resolved) {
                                    resolved = true;
                                    resolve("");
                                }
                            });
                            plugin
                                .start({
                                language: lang,
                                maxResults: 1,
                                partialResults: false,
                                popup: true,
                            })
                                .then(function (result) {
                                var _a, _b, _c;
                                if (!resolved) {
                                    resolved = true;
                                    var transcript = (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.matches) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
                                    resolve(transcript);
                                }
                            })
                                .catch(function (err) {
                                if (!resolved) {
                                    resolved = true;
                                    if (lang === "ne-NP") {
                                        listenNative("en-IN").then(resolve).catch(reject);
                                    }
                                    else {
                                        reject(err);
                                    }
                                }
                            });
                        })];
            }
        });
    });
}
function listenWeb(lang) {
    return new Promise(function (resolve, reject) {
        var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Ctor) {
            reject(new Error("unsupported"));
            return;
        }
        var recognition = new Ctor();
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = function (event) {
            var _a, _b, _c;
            var transcript = (_c = (_b = (_a = event.results[0]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.transcript) === null || _c === void 0 ? void 0 : _c.trim();
            resolve(transcript !== null && transcript !== void 0 ? transcript : "");
        };
        recognition.onerror = function () {
            if (lang === "ne-NP") {
                recognition.lang = "en-IN";
                recognition.start();
            }
            else {
                reject(new Error("Speech recognition error"));
            }
        };
        recognition.onend = function () { return undefined; };
        recognition.start();
    });
}
