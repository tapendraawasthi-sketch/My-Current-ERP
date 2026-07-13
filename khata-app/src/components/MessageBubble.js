"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MessageBubble;
function MessageBubble(_a) {
    var role = _a.role, text = _a.text;
    var isUser = role === "user";
    return (<div className={"flex ".concat(isUser ? "justify-end" : "justify-start", " mb-2")}>
      <div className={"max-w-[85%] rounded-md px-3 py-2 text-[12px] ".concat(isUser ? "bg-[#1557b0] text-white" : "border border-gray-200 bg-white text-gray-700")}>
        {text}
      </div>
    </div>);
}
