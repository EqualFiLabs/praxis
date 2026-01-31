export type SensitiveSection = {
  header: string;
  level: number;
  startLine: number;
  endLine: number;
};

const SENSITIVE_MARKER = "[SENSITIVE]";

function isHeading(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  if (!match) return null;
  return { level: match[1].length, text: match[2].trim() };
}

export function parseSensitiveSections(raw: string): SensitiveSection[] {
  const lines = raw.split("\n");
  const sections: SensitiveSection[] = [];
  let current: SensitiveSection | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const heading = isHeading(line);
    if (heading) {
      if (current && heading.level <= current.level) {
        current.endLine = i - 1;
        sections.push(current);
        current = null;
      }
      if (heading.text.includes(SENSITIVE_MARKER)) {
        current = {
          header: heading.text,
          level: heading.level,
          startLine: i,
          endLine: lines.length - 1
        };
      }
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

export function stripSensitiveSections(raw: string): string {
  const lines = raw.split("\n");
  const sections = parseSensitiveSections(raw);
  if (sections.length === 0) return raw;

  const toRemove = new Set<number>();
  for (const section of sections) {
    for (let i = section.startLine; i <= section.endLine; i += 1) {
      toRemove.add(i);
    }
  }

  return lines.filter((_, idx) => !toRemove.has(idx)).join("\n");
}
