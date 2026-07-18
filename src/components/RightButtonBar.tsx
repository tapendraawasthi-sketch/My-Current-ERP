/**
 * Busy / Tally shortcut sidebar — retired (Wave A / Function 5).
 * Navigation uses PrimarySideNav + CommandPalette.
 * Kept as a no-op so BusyShell.ShortcutSidebar imports stay safe.
 */
import React from "react";

export const RightButtonBar: React.FC<{ onShortcut?: (key: string) => void }> = () => null;

export default RightButtonBar;
