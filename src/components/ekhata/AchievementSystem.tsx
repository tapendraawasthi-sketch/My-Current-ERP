/**
 * Gamification — achievements and daily challenges for consistent bookkeeping.
 */
import { useEffect, useState } from "react";
import { getDB } from "@/lib/db";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
}

const STORAGE_KEY = "ekhata-achievements-v1";

const ACHIEVEMENT_DEFS: Omit<Achievement, "unlocked" | "unlockedAt">[] = [
  { id: "first_entry", emoji: "🌱", title: "First Entry", description: "Post your first journal entry" },
  { id: "daily_keeper", emoji: "📅", title: "Daily Keeper", description: "Post entries 3 days in a row" },
  { id: "weekly_streak", emoji: "🔥", title: "Weekly Streak", description: "Post entries 7 days in a row" },
  { id: "century", emoji: "💯", title: "Century", description: "100 total entries" },
  { id: "perfect_balance", emoji: "⚖️", title: "Perfect Balance", description: "50 balanced entries" },
  { id: "report_reader", emoji: "📊", title: "Report Reader", description: "Generate your first report" },
  { id: "student", emoji: "🎓", title: "Student", description: "Complete 5 education interactions" },
  { id: "master", emoji: "🏆", title: "Master Accountant", description: "1000 entries, all balanced" },
  { id: "nepali_pro", emoji: "🇳🇵", title: "Nepali Pro", description: "Enter 50 entries in Nepali" },
];

function loadUnlocked(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUnlocked(data: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function unlockAchievement(id: string) {
  const data = loadUnlocked();
  if (!data[id]) {
    data[id] = new Date().toISOString();
    saveUnlocked(data);
  }
}

/** Evaluate achievements from Dexie voucher count */
export async function evaluateAchievements(): Promise<Achievement[]> {
  const db = getDB();
  const vouchers = await db.vouchers
    .filter((v) => Boolean(v.type?.startsWith("khata_")) && v.status === "posted")
    .toArray();

  const unlocked = loadUnlocked();
  const count = vouchers.length;

  const checks: Record<string, boolean> = {
    first_entry: count >= 1,
    century: count >= 100,
    master: count >= 1000,
    perfect_balance: count >= 50,
  };

  const now = new Date().toISOString();
  for (const [id, ok] of Object.entries(checks)) {
    if (ok && !unlocked[id]) unlocked[id] = now;
  }
  saveUnlocked(unlocked);

  return ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    unlocked: Boolean(unlocked[def.id]),
    unlockedAt: unlocked[def.id],
  }));
}

interface AchievementSystemProps {
  compact?: boolean;
}

/** Achievement badges widget for e-Khata panel */
export default function AchievementSystem({ compact = false }: AchievementSystemProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    evaluateAchievements().then(setAchievements).catch(() => undefined);
  }, []);

  const unlocked = achievements.filter((a) => a.unlocked);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {unlocked.slice(0, 4).map((a) => (
          <span key={a.id} title={a.title} className="text-[14px]">
            {a.emoji}
          </span>
        ))}
        {unlocked.length > 4 && (
          <span className="text-[10px] text-gray-500">+{unlocked.length - 4}</span>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md bg-white p-3">
      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Achievements
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`text-center p-2 rounded-md border ${
              a.unlocked ? "border-[#1557b0]/30 bg-[#1557b0]/5" : "border-gray-100 opacity-40"
            }`}
            title={a.description}
          >
            <div className="text-[18px]">{a.emoji}</div>
            <div className="text-[10px] font-medium text-gray-700 mt-0.5">{a.title}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-2">
        Daily challenge: 5 entries today — keep your khata up to date!
      </p>
    </div>
  );
}
