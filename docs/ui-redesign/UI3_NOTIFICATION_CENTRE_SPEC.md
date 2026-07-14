# UI-3 Notification Centre Spec

**Authority:** Zustand `notifications` + Dexie `db.notifications` via `addNotification` / `markNotificationRead` / `clearNotifications`.

**UI:** `NotificationCentre` Drawer + bell in TopCommandBar.

**Noise policy:** Centre is for high-value alerts (conflicts, failures, approvals). Routine success remains toast (`react-hot-toast`).

**No new notification database.**
