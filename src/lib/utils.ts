/** Joins class names, skipping empty values. */
export const cn = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" ");
