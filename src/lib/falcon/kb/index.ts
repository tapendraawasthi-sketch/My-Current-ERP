import type { KBEntry } from "../types";
import { KB_GENERAL } from "./general";
import { KB_MASTERS } from "./masters";
import { KB_TRANSACTIONS } from "./transactions";
import { KB_REPORTS } from "./reports";
import { KB_EXTENDED } from "./extended";
import { KB_EXTENDED2 } from "./extended2";
import { KB_EXTENDED3 } from "./extended3";
import { KB_EXTENDED4 } from "./extended4";
import { KB_EXTENDED5 } from "./extended5";
import { KB_EXTENDED6 } from "./extended6";

export const KNOWLEDGE_BASE: KBEntry[] = [
  ...KB_GENERAL,
  ...KB_MASTERS,
  ...KB_TRANSACTIONS,
  ...KB_REPORTS,
  ...KB_EXTENDED,
  ...KB_EXTENDED2,
  ...KB_EXTENDED3,
  ...KB_EXTENDED4,
  ...KB_EXTENDED5,
  ...KB_EXTENDED6,
];
