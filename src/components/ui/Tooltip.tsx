import React, { ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top" }) => {
  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2 origin-top",
    left: "right-full top-1/2 -translate-y-1/2 mr-2 origin-right",
    right: "left-full top-1/2 -translate-y-1/2 ml-2 origin-left",
  };

  const arrowStyles = {
    top: "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-gray-800 border-x-transparent border-b-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-gray-800 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-gray-800 border-y-transparent border-r-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-gray-800 border-y-transparent border-l-transparent",
  };

  return (
    <div className="group relative inline-block">
      {children}
      <div
        className={`
          absolute z-50 pointer-events-none scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 delay-100
          ${positionStyles[position]}
        `}
      >
        <div className="relative bg-gray-800 text-white text-[11px] font-medium py-1 px-2.5 rounded-md shadow-md whitespace-nowrap leading-none border border-gray-700">
          {content}
          <div className={`absolute border-4 ${arrowStyles[position]}`} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(Tooltip);
