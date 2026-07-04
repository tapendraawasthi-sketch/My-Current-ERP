interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  text: string;
}

export default function MessageBubble({ role, text }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[85%] rounded-md px-3 py-2 text-[12px] ${
          isUser ? "bg-[#1557b0] text-white" : "border border-gray-200 bg-white text-gray-700"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
