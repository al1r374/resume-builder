import type { Profile } from "./schemas.js";

export function flattenSkills(skills: Profile["skills"]): string[] {
  if (Array.isArray(skills)) {
    return skills.map((s) => s.trim()).filter(Boolean);
  }
  const out: string[] = [];
  for (const values of Object.values(skills ?? {})) {
    for (const item of values) {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

export function skillsByCategory(
  skills: Profile["skills"],
): Array<{ category: string; items: string[] }> {
  if (Array.isArray(skills)) {
    return skills.length ? [{ category: "Skills", items: skills }] : [];
  }
  return Object.entries(skills ?? {})
    .map(([category, items]) => ({
      category: humanizeCategory(category),
      items: items.map((i) => i.trim()).filter(Boolean),
    }))
    .filter((g) => g.items.length > 0);
}

function humanizeCategory(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeSkillToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, "")
    .trim();
}

export function skillMatches(candidateSkill: string, required: string): boolean {
  const a = normalizeSkillToken(candidateSkill);
  const b = normalizeSkillToken(required);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
