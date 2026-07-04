import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const PARSE_SCRIPT = path.join(REPO_ROOT, "erp_bot/scripts/parse_khata_cli.py");

type KhataIntent =
  | "khata_credit_sale"
  | "khata_cash_sale"
  | "khata_payment_in"
  | "khata_purchase"
  | "khata_payment_out"
  | "khata_expense";

export interface KhataParseResult {
  clarifying_question?: string;
  card?: {
    intent: KhataIntent;
    party: string | null;
    amount: number;
    item: string | null;
    date: string;
    raw_text: string;
  };
}

interface FalconPayload {
  intent?: string | null;
  clarifying_question?: string | null;
  AMOUNT?: number | null;
  PARTY?: string | null;
  ITEM?: string | null;
  DATE?: string | null;
}

function runPythonParser(rawText: string): Promise<FalconPayload> {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_PATH || "python3";
    const child = spawn(python, [PARSE_SCRIPT, rawText], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Falcon NLU exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()) as FalconPayload);
      } catch {
        reject(new Error(`Invalid Falcon NLU output: ${stdout}`));
      }
    });
  });
}

export async function parseKhataTransaction(rawText: string): Promise<KhataParseResult> {
  const parsed = await runPythonParser(rawText);

  if (parsed.clarifying_question) {
    return { clarifying_question: parsed.clarifying_question };
  }

  if (!parsed.intent || !parsed.AMOUNT) {
    return {
      clarifying_question: "Ke transaction ho? Thora clear lekhnus.",
    };
  }

  const party =
    parsed.PARTY && parsed.PARTY !== "UNKNOWN" ? parsed.PARTY : null;

  return {
    card: {
      intent: parsed.intent as KhataIntent,
      party,
      amount: parsed.AMOUNT,
      item: parsed.ITEM ?? null,
      date: parsed.DATE ?? new Date().toISOString().slice(0, 10),
      raw_text: rawText.trim(),
    },
  };
}
