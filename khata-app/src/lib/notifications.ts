import { isNativePlatform } from "./platform";

interface ReminderOptions {
  id: number;
  title: string;
  body: string;
  scheduleAt?: Date;
}

export async function scheduleReminder(options: ReminderOptions): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    const permResult = await LocalNotifications.requestPermissions();
    if (permResult.display !== "granted") return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: options.title,
          body: options.body,
          id: options.id,
          schedule: options.scheduleAt
            ? { at: options.scheduleAt }
            : { at: new Date(Date.now() + 1000) },
          sound: undefined,
          actionTypeId: "",
          extra: null,
        },
      ],
    });
  } catch (err) {
    console.warn("Failed to schedule notification:", err);
  }
}

export async function cancelReminder(id: number): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // ignore
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    // ignore
  }
}
