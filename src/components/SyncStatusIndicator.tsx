/**
 * Legacy sync chip — retired (Wave C / Function 19).
 * App shell uses SyncStatusControl (honest aggregated outbox + event queue).
 * Kept as a thin re-export so TopMenuBar imports stay safe.
 */
export { default } from "./shell/SyncStatusControl";
