import { rebuildFromCheckpoint, fullReplay } from "./projectionRebuilder";
import { runFullParityValidation } from "./projectionParity";
import { updateProjectionStatus } from "./projectionCheckpoint";
import { ALL_PROJECTION_NAMES, type ProjectionName } from "./projectionState";
import { recordProjectionDiagnostic } from "./projectionDiagnostics";

export interface RepairResult {
  rebuilt: boolean;
  parityPassed: boolean;
  projectionName?: ProjectionName;
}

export async function repairProjection(projectionName: ProjectionName): Promise<RepairResult> {
  recordProjectionDiagnostic({
    projectionName,
    stage: "rebuild-start",
    message: "repair initiated",
    timestamp: new Date().toISOString(),
  });

  await updateProjectionStatus(projectionName, "rebuilding");
  await rebuildFromCheckpoint(projectionName, false);
  const parity = await runFullParityValidation();

  const passed = parity.checks
    .filter((c) => c.projectionName === projectionName)
    .every((c) => c.passed);

  await updateProjectionStatus(projectionName, passed ? "ready" : "error");

  return { rebuilt: true, parityPassed: passed, projectionName };
}

export async function repairAllProjections(): Promise<RepairResult> {
  await fullReplay(false);
  const parity = await runFullParityValidation();
  for (const name of ALL_PROJECTION_NAMES) {
    await updateProjectionStatus(name, parity.passed ? "ready" : "error");
  }
  return { rebuilt: true, parityPassed: parity.passed };
}
