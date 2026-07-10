import { describe, expect, it } from "vitest";
import { loadPluginFromManifest } from "@/domains/plugin-kernel/pluginLoader";

describe("pluginLoader", () => {
  it("uses pluginLogger without ReferenceError when validation fails", async () => {
    await expect(loadPluginFromManifest({} as never)).resolves.toBeNull();
  });

  it("loads a valid manifest", async () => {
    const descriptor = await loadPluginFromManifest({
      id: "test-plugin-loader",
      name: "Test Plugin",
      version: "1.0.0",
      capabilities: ["report.generate"],
      permissions: ["query.execute"],
      extensionPoints: ["report.engine"],
    });
    expect(descriptor?.id).toBe("test-plugin-loader");
  });
});
