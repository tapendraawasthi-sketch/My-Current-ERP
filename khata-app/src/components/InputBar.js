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
exports.default = InputBar;
var react_1 = require("react");
var ocrInput_1 = require("../lib/ocrInput");
var voiceInput_1 = require("../lib/voiceInput");
var platform_1 = require("../lib/platform");
function InputBar(_a) {
    var _this = this;
    var disabled = _a.disabled, onSend = _a.onSend;
    var _b = (0, react_1.useState)(""), value = _b[0], setValue = _b[1];
    var _c = (0, react_1.useState)(null), voiceTip = _c[0], setVoiceTip = _c[1];
    var fileRef = (0, react_1.useRef)(null);
    var handleSend = function () {
        var trimmed = value.trim();
        if (!trimmed || disabled)
            return;
        onSend(trimmed);
        setValue("");
    };
    var handleVoice = function () { return __awaiter(_this, void 0, void 0, function () {
        var transcript, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(0, voiceInput_1.isVoiceInputSupported)()) {
                        setVoiceTip("Voice input is not supported on this browser. Please type your entry.");
                        return [2 /*return*/];
                    }
                    setVoiceTip(null);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, voiceInput_1.listenOnce)()];
                case 2:
                    transcript = _b.sent();
                    if (transcript)
                        setValue(transcript);
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    setVoiceTip("Voice input is not supported on this browser. Please type your entry.");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handlePhoto = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var file, text;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (!file)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, ocrInput_1.extractAmountFromImage)(file)];
                case 1:
                    text = (_b.sent()).text;
                    setValue(text);
                    event.target.value = "";
                    return [2 /*return*/];
            }
        });
    }); };
    var handleNativeCamera = function () { return __awaiter(_this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, ocrInput_1.captureAndExtract)()];
                case 1:
                    result = _a.sent();
                    if (result) {
                        setValue(result.text);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleCameraClick = function () {
        var _a;
        if ((0, platform_1.isNativePlatform)()) {
            handleNativeCamera();
        }
        else {
            (_a = fileRef.current) === null || _a === void 0 ? void 0 : _a.click();
        }
    };
    return (<div className="border-t border-gray-200 bg-white p-2">
      {voiceTip && <p className="mb-1 text-[11px] text-amber-700">{voiceTip}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleVoice} disabled={disabled} className="h-8 w-8 rounded-md border border-gray-300 text-[12px] text-gray-700" aria-label="Voice input">
          🎤
        </button>
        <button type="button" onClick={handleCameraClick} disabled={disabled} className="h-8 w-8 rounded-md border border-gray-300 text-[12px] text-gray-700" aria-label="Photo input">
          📷
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/>
        <input value={value} onChange={function (event) { return setValue(event.target.value); }} onKeyDown={function (event) {
            if (event.key === "Enter")
                handleSend();
        }} placeholder="Type your khata entry..." className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20" disabled={disabled}/>
        <button type="button" onClick={handleSend} disabled={disabled || !value.trim()} className="h-8 rounded-md bg-[#1557b0] px-3 text-[12px] font-medium text-white hover:bg-[#0f4a96] disabled:opacity-50">
          Send
        </button>
      </div>
    </div>);
}
