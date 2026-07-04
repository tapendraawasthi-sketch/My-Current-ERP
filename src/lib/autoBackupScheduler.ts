import { getLastAutoBackupAt, isAutoBackupDue, runAutoBackup } from "./backupService";
import { mergeSystemConfiguration } from "./systemConfiguration";

let timerHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

type CompanySettingsLike = {
  name?: string;
  companyName?: string;
  legalName?: string;
  systemConfiguration?: unknown;
};

async function tick(getSettings: () => CompanySettingsLike | undefined): Promise<void> {
  if (running) return;
  const companySettings = getSettings();
  const config = mergeSystemConfiguration(
    companySettings?.systemConfiguration as Parameters<typeof mergeSystemConfiguration>[0],
  );
  if (!config.backup.autoBackupEnabled) return;

  const lastAt = getLastAutoBackupAt();
  if (!isAutoBackupDue(config.backup.frequency, lastAt)) return;

  running = true;
  try {
    await runAutoBackup(companySettings);
  } finally {
    running = false;
  }
}

export function startAutoBackupScheduler(getSettings: () => CompanySettingsLike | undefined): void {
  if (timerHandle) return;

  void tick(getSettings);
  timerHandle = setInterval(
    () => {
      void tick(getSettings);
    },
    60 * 60 * 1000,
  );
}

export function stopAutoBackupScheduler(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}
