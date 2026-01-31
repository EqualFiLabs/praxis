export type ContentTag =
  | "trusted"
  | "untrusted"
  | "external"
  | "web"
  | "oracle"
  | "user"
  | "system";

export type TaggedContent = {
  content: string;
  tags: ContentTag[];
  source?: string;
};

export type SanitizationOptions = {
  allowSources?: string[];
  stripTags?: ContentTag[];
};

const DEFAULT_STRIP_TAGS: ContentTag[] = ["untrusted", "external", "web"];

export function sanitizeTaggedContent(
  entries: TaggedContent[],
  options: SanitizationOptions = {}
): TaggedContent[] {
  const allowSources = options.allowSources ?? [];
  const stripTags = options.stripTags ?? DEFAULT_STRIP_TAGS;
  return entries.filter((entry) => {
    if (entry.source && allowSources.includes(entry.source)) {
      return true;
    }
    if (entry.tags.some((tag) => stripTags.includes(tag))) {
      return false;
    }
    return true;
  });
}
