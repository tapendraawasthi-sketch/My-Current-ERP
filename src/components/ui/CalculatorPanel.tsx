// @ts-nocheck
import React, { useState, useEffect } from "react";
import toast from "@/lib/appToast";

export const CalculatorPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInsertValue?: (value: string) => void;
}> = ({ isOpen, onClose, onInsertValue }) => {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [memory, setMemory] = useState(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"calculator" | "odbc">("calculator");
  const [odbcStatus, setOdbcStatus] = useState<"running" | "stopped">("stopped");
  const [odbcPort, setOdbcPort] = useState("9000");
  const [commandInput, setCommandInput] = useState("");
  const [commandOutput, setCommandOutput] = useState("");

  // Handle keyboard events when panel is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        onClose();
        return;
      }

      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        handleButtonPress(key);
      } else if (key === ".") {
        handleButtonPress(".");
      } else if (key === "+") {
        handleButtonPress("+");
      } else if (key === "-") {
        handleButtonPress("-");
      } else if (key === "*") {
        handleButtonPress("×");
      } else if (key === "/") {
        handleButtonPress("÷");
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        evaluateExpression();
      } else if (key === "Backspace") {
        handleButtonPress("C");
      } else if (key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleButtonPress = (btn: string) => {
    switch (btn) {
      case "C": // Clear entry
      case "CE":
        setExpression((prev) => prev.slice(0, -1));
        break;
      case "AC": // All clear
        setExpression("");
        setResult("");
        break;
      case "=":
        evaluateExpression();
        break;
      case "M+":
        {
          const num = parseFloat(result || "0");
          if (!isNaN(num)) {
            const newMemory = memory + num;
            setMemory(newMemory);
            setHasMemory(newMemory !== 0);
            toast.success(`Added to memory: ${num}`);
          }
        }
        break;
      case "M-":
        {
          const num = parseFloat(result || "0");
          if (!isNaN(num)) {
            const newMemory = memory - num;
            setMemory(newMemory);
            setHasMemory(newMemory !== 0);
            toast.success(`Subtracted from memory: ${num}`);
          }
        }
        break;
      case "MR":
        setExpression((prev) => prev + memory.toString());
        break;
      case "MC":
        setMemory(0);
        setHasMemory(false);
        toast.success("Memory cleared");
        break;
      case "√":
        try {
          const num = parseFloat(expression || "0");
          if (!isNaN(num)) {
            const sqrtResult = Math.sqrt(Math.abs(num));
            setResult(
              sqrtResult.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              }),
            );
            const newHistoryItem = `√(${expression || "0"}) = ${sqrtResult.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
            addToHistory(newHistoryItem);
          }
        } catch (e) {
          setResult("Math Error");
        }
        break;
      case "%":
        setExpression((prev) => prev + "%");
        break;
      case "+":
      case "-":
      case "×":
      case "÷":
        setExpression((prev) => `${prev} ${btn} `);
        break;
      default:
        setExpression((prev) => prev + btn);
    }
  };

  const evaluateExpression = () => {
    let expr = expression.trim();
    if (!expr) return;

    // Replace symbols
    expr = expr.replace(/×/g, "*").replace(/÷/g, "/");

    // Handle percentage calculations (e.g. "number + number%")
    expr = expr.replace(
      /(\d+(\.\d+)?)\s*(\+|\-|\*|\/)\s*(\d+(\.\d+)?)%/g,
      (match, num1, _, op, num2) => {
        const calculatedPercentage = (parseFloat(num1) * parseFloat(num2)) / 100;
        return `${num1} ${op} ${calculatedPercentage}`;
      },
    );

    // Handle standalone percentages like "18%" -> "0.18"
    expr = expr.replace(/(\d+(\.\d+)?)%/g, (match, num) => {
      return `(${num}/100)`;
    });

    try {
      // Basic safety checks to prevent injection
      if (
        /[{}]/.test(expr) ||
        /constructor|__proto__|prototype|import|require|window|document/i.test(expr)
      ) {
        throw new Error("Invalid expression");
      }

      const computed = Function('"use strict"; return (' + expr + ")")();

      if (isNaN(computed) || !isFinite(computed)) {
        setResult("Math Error");
      } else {
        const formatted = computed.toLocaleString("en-IN", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        });
        setResult(formatted);

        // Add to history
        const newHistoryItem = `${expression} = ${formatted}`;
        addToHistory(newHistoryItem);

        // Call insert value callback if provided
        if (onInsertValue) {
          onInsertValue(computed.toString());
        }

        // Clear expression for next calculation
        setExpression("");
      }
    } catch (e) {
      setResult("Math Error");
    }
  };

  const addToHistory = (item: string) => {
    setHistory((prev) => {
      const newHistory = [item, ...prev];
      return newHistory.slice(0, 10); // Keep max 10 items
    });
  };

  const handleHistoryItemClick = (item: string) => {
    const parts = item.split("=");
    if (parts.length > 0) {
      const expr = parts[0].trim();
      setExpression(expr);
    }
  };

  const handleStartOdbc = () => {
    setOdbcStatus("running");
    toast.success("ODBC Server started");
  };

  const handleStopOdbc = () => {
    setOdbcStatus("stopped");
    toast.success("ODBC Server stopped");
  };

  const handleExecuteCommand = () => {
    if (commandInput.trim()) {
      setCommandOutput(`Executed: ${commandInput}\nResult: Command processed`);
      toast.success("Command executed");
    }
  };

  const renderCalculatorContent = () => (
    <div className="flex h-full p-2.5 gap-3 bg-[#f5f6fa]">
      {/* Left Column */}
      <div className="flex-1 flex flex-col">
        {/* Display Area */}
        <div className="bg-white border border-gray-300 p-2 rounded-md mb-2 flex flex-col items-end shadow-sm">
          <div className="text-[13px] text-gray-500 min-h-[20px] font-mono">
            {expression || "0"}
          </div>
          <div className="text-[20px] font-bold text-gray-800 font-mono tracking-tight">
            {result || "0.00"}
          </div>
        </div>

        {/* Button Grid */}
        <div className="grid grid-cols-4 gap-1 flex-1">
          {[
            ["7", "8", "9", "÷"],
            ["4", "5", "6", "×"],
            ["1", "2", "3", "-"],
            ["0", ".", "=", "+"],
            ["C", "AC", "(", ")"],
            ["%", "√", "M+", "MR"],
            ["M-", "MC", "CE"],
          ].map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {row.map((btn, colIndex) => {
                const isOperator = ["+", "-", "×", "÷", "="].includes(btn);
                const isMemory = ["M+", "M-", "MR", "MC"].includes(btn);
                const isClear = ["C", "AC", "CE"].includes(btn);

                let btnClass =
                  "h-7 rounded-[3px] text-[13px] font-semibold flex items-center justify-center transition-colors border outline-none focus:ring-2 focus:ring-[#1557b0]/20 ";

                if (btn === "=") {
                  btnClass += "bg-[#1557b0] text-white hover:bg-[#0f4a96] border-[#0f4a96]";
                } else if (isOperator) {
                  btnClass += "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200";
                } else if (isMemory) {
                  btnClass += "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100";
                } else if (isClear) {
                  btnClass += "bg-red-50 border-red-200 text-red-700 hover:bg-red-100";
                } else {
                  btnClass += "bg-white border-gray-200 text-gray-800 hover:bg-gray-50";
                }

                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleButtonPress(btn)}
                    className={btnClass}
                  >
                    {btn}
                  </button>
                );
              })}
              {rowIndex === 6 && (
                <button
                  key="ce-span"
                  onClick={() => handleButtonPress("CE")}
                  className="col-span-2 h-7 rounded-[3px] text-[13px] font-semibold flex items-center justify-center transition-colors border bg-red-50 border-red-200 text-red-700 hover:bg-red-100 outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  CE
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right Column - History */}
      <div className="w-[160px] flex flex-col bg-white border border-gray-200 rounded-md p-2 shadow-sm">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-1">
          History
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic mt-2 text-center">No history yet</div>
          ) : (
            history.map((item, index) => (
              <div
                key={index}
                onClick={() => handleHistoryItemClick(item)}
                className="text-[11px] text-gray-700 py-1.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 hover:text-[#1557b0] truncate transition-colors"
                title={item}
              >
                {item}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderOdbcContent = () => (
    <div className="p-3 flex flex-col gap-3 bg-[#f5f6fa] h-full overflow-y-auto">
      {/* ODBC Server Section */}
      <div className="bg-white p-3 border border-gray-200 rounded-md shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-1.5 ${odbcStatus === "running" ? "bg-[#059669]" : "bg-[#dc2626]"}`}
            ></div>
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
              {odbcStatus === "running" ? "Running" : "Stopped"}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-[11px] font-medium text-gray-600 mr-2">Port:</span>
            <input
              type="text"
              value={odbcPort}
              onChange={(e) => setOdbcPort(e.target.value)}
              className="h-7 px-2 text-[12px] border border-gray-300 rounded-[3px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] w-[60px]"
            />
          </div>
        </div>

        <div className="text-[11px] text-gray-500 mb-1">
          Data Source Name: <span className="font-medium text-gray-800">CompanyData_2024</span>
        </div>
        <div className="text-[11px] text-gray-500 mb-3">
          Connected Clients: <span className="font-medium text-gray-800">0 clients connected</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {odbcStatus === "stopped" ? (
            <button
              onClick={handleStartOdbc}
              className="h-7 px-3 bg-[#059669] hover:bg-green-700 text-white text-[11px] font-medium rounded-[3px] transition-colors"
            >
              Start ODBC Server
            </button>
          ) : (
            <button
              onClick={handleStopOdbc}
              className="h-7 px-3 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-medium rounded-[3px] transition-colors"
            >
              Stop Server
            </button>
          )}
          <button className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-[3px] hover:bg-gray-50 transition-colors">
            Configure
          </button>
        </div>
      </div>

      {/* Command Entry Section */}
      <div className="bg-white p-3 border border-gray-200 rounded-md shadow-sm flex flex-col gap-2 flex-1">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Command Entry
        </label>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleExecuteCommand();
          }}
          placeholder="e.g. goto ledger 'ABC Traders' or calc 50000 * 0.18"
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] w-full"
        />
        <div className="text-[10px] text-gray-500 bg-gray-50 p-1.5 rounded border border-gray-100 font-mono">
          goto ledger 'Name' | goto voucher SI-001 | calc expr | report balance-sheet
        </div>
        <div className="flex justify-end mt-1">
          <button
            onClick={handleExecuteCommand}
            className="h-7 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-[3px] transition-colors shadow-sm"
          >
            Execute Command
          </button>
        </div>

        {commandOutput && (
          <pre className="mt-1 bg-gray-900 text-green-400 p-2 text-[11px] rounded-[3px] max-h-[70px] overflow-auto font-mono whitespace-pre-wrap">
            {commandOutput}
          </pre>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[260px] bg-white border-t border-gray-300 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] z-[9998] flex flex-col font-sans">
      {/* Header Bar */}
      <div className="h-8 bg-[#1e2433] flex items-center justify-between px-3 text-white">
        <div className="flex gap-1 h-full pt-1">
          <button
            onClick={() => setActiveTab("calculator")}
            className={`px-3 py-1 rounded-t-[4px] text-[11px] font-medium transition-colors border-b-2 ${
              activeTab === "calculator"
                ? "bg-white text-gray-800 border-[#1557b0]"
                : "text-gray-300 hover:text-white hover:bg-[#273148] border-transparent"
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setActiveTab("odbc")}
            className={`px-3 py-1 rounded-t-[4px] text-[11px] font-medium transition-colors border-b-2 ${
              activeTab === "odbc"
                ? "bg-white text-gray-800 border-[#1557b0]"
                : "text-gray-300 hover:text-white hover:bg-[#273148] border-transparent"
            }`}
          >
            ODBC / Command
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 font-medium">Ctrl+N to close</span>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center bg-transparent hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
            title="Close (Esc)"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-[#f5f6fa]">
        {activeTab === "calculator" ? renderCalculatorContent() : renderOdbcContent()}
      </div>
    </div>
  );
};

export default CalculatorPanel;
