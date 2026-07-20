import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DUAL_WRITER_SYNC_BURNDOWN_ADR,
  GAP_P0_001_CLOSED,
  GAP_P1_002_CLOSED,
  OEC_SOLE,
  PACK_READY,
  PRODUCTION_APPROVED,
  dualWriterSyncBurndownSnapshot,
} from "@/platform/release/dualWriterSyncBurndownPolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-D3 dual-writer sync burn-down pack", () => {
  it("keeps gaps reduced not closed", () => {
    const snap = dualWriterSyncBurndownSnapshot();
    expect(snap.authority).toBe(DUAL_WRITER_SYNC_BURNDOWN_ADR);
    expect(snap.step).toBe("PR-D3");
    expect(snap.packReady).toBe(true);
    expect(PACK_READY).toBe(true);
    expect(snap.gapP0001Closed).toBe(false);
    expect(GAP_P0_001_CLOSED).toBe(false);
    expect(snap.gapP1002Closed).toBe(false);
    expect(GAP_P1_002_CLOSED).toBe(false);
    expect(snap.oecSole).toBe(false);
    expect(OEC_SOLE).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("ships schedule and artifacts", () => {
    const doc = join(
      ROOT,
      "docs/mokxya-ai/releases/DUAL_WRITER_SYNC_RESIDUAL_BURNDOWN_V1.md",
    );
    expect(existsSync(doc)).toBe(true);
    const text = readFileSync(doc, "utf8");
    expect(text).toContain("REDUCED");
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-d3/SIGN_NOTE.md"))).toBe(
      true,
    );
  });
});
