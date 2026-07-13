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
exports.extractAmountFromImage = extractAmountFromImage;
exports.captureAndExtract = captureAndExtract;
var platform_1 = require("./platform");
function captureImageNative() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, Camera, CameraResultType, CameraSource, photo, response, blob, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@capacitor/camera"); })];
                case 1:
                    _a = _c.sent(), Camera = _a.Camera, CameraResultType = _a.CameraResultType, CameraSource = _a.CameraSource;
                    return [4 /*yield*/, Camera.getPhoto({
                            quality: 80,
                            allowEditing: false,
                            resultType: CameraResultType.DataUrl,
                            source: CameraSource.Camera,
                        })];
                case 2:
                    photo = _c.sent();
                    if (!photo.dataUrl)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, fetch(photo.dataUrl)];
                case 3:
                    response = _c.sent();
                    return [4 /*yield*/, response.blob()];
                case 4:
                    blob = _c.sent();
                    return [2 /*return*/, new File([blob], "capture.jpg", { type: "image/jpeg" })];
                case 5:
                    _b = _c.sent();
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function extractAmountFromImage(file) {
    return __awaiter(this, void 0, void 0, function () {
        var Tesseract, result, text, confidence, amountMatch;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("tesseract.js"); })];
                case 1:
                    Tesseract = _c.sent();
                    return [4 /*yield*/, Tesseract.recognize(file, "nep+eng")];
                case 2:
                    result = _c.sent();
                    text = result.data.text.replace(/\s+/g, " ").trim();
                    confidence = (_a = result.data.confidence) !== null && _a !== void 0 ? _a : 0;
                    amountMatch = text.match(/(?:rs\.?|npr\.?|₨)?\s*(\d+(?:\.\d+)?)/i);
                    return [2 /*return*/, {
                            text: (_b = amountMatch === null || amountMatch === void 0 ? void 0 : amountMatch[1]) !== null && _b !== void 0 ? _b : text,
                            confidence: confidence,
                        }];
            }
        });
    });
}
function captureAndExtract() {
    return __awaiter(this, void 0, void 0, function () {
        var file;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(0, platform_1.isNativePlatform)())
                        return [2 /*return*/, null];
                    return [4 /*yield*/, captureImageNative()];
                case 1:
                    file = _a.sent();
                    if (!file)
                        return [2 /*return*/, null];
                    return [2 /*return*/, extractAmountFromImage(file)];
            }
        });
    });
}
