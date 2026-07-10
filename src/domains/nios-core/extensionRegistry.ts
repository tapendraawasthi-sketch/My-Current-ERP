export interface ExtensionDescriptor {
  id: string;
  name: string;
  entryPoint: string;
  type: "sutra" | "falcon" | "ekhata" | "nios" | "orbix" | "custom";
  readOnly: boolean;
}

const extensions = new Map<string, ExtensionDescriptor>();

const DEFAULT_EXTENSIONS: ExtensionDescriptor[] = [
  { id: "ext-sutra", name: "SUTRA AI", entryPoint: "sutra", type: "sutra", readOnly: true },
  { id: "ext-falcon", name: "Falcon AI", entryPoint: "falcon", type: "falcon", readOnly: true },
  { id: "ext-ekhata", name: "e-Khata AI", entryPoint: "ekhata", type: "ekhata", readOnly: true },
  { id: "ext-nios", name: "NIOS v3", entryPoint: "nios", type: "nios", readOnly: true },
  { id: "ext-orbix", name: "Orbix AI", entryPoint: "orbix", type: "orbix", readOnly: true },
];

for (const ext of DEFAULT_EXTENSIONS) {
  extensions.set(ext.id, ext);
}

export function registerExtension(descriptor: ExtensionDescriptor): void {
  extensions.set(descriptor.id, descriptor);
}

export function getExtension(id: string): ExtensionDescriptor | null {
  return extensions.get(id) ?? null;
}

export function listExtensions(): ExtensionDescriptor[] {
  return Array.from(extensions.values());
}

export function getExtensionByEntryPoint(entryPoint: string): ExtensionDescriptor | null {
  return listExtensions().find((e) => e.entryPoint === entryPoint) ?? null;
}
