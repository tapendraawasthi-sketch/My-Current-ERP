export interface SkillDescriptor {
  id: string;
  name: string;
  capabilityId: string;
  promptId?: string;
}

const skills = new Map<string, SkillDescriptor>();

const DEFAULT_SKILLS: SkillDescriptor[] = [
  { id: "read-trial-balance", name: "Read Trial Balance", capabilityId: "erp.read.trial_balance" },
  { id: "propose-voucher", name: "Propose Voucher", capabilityId: "erp.propose.voucher", promptId: "voucher-propose" },
  { id: "propose-khata", name: "Propose Khata Entry", capabilityId: "khata.propose.entry", promptId: "khata-propose" },
];

for (const skill of DEFAULT_SKILLS) {
  skills.set(skill.id, skill);
}

export function registerSkill(descriptor: SkillDescriptor): void {
  skills.set(descriptor.id, descriptor);
}

export function getSkill(id: string): SkillDescriptor | null {
  return skills.get(id) ?? null;
}

export function listSkills(): SkillDescriptor[] {
  return Array.from(skills.values());
}
