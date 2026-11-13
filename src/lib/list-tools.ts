// Search and pagination for lists. Pure helpers (no network), shared by every list page.

/** Keeps the items whose text contains every word the person typed (case-insensitive). */
export function filterItems<T>(items: T[], query: string, textOf: (item: T) => string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const text = textOf(item).toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export interface Paged<T> {
  slice: T[];
  page: number; // 1-based, clamped into range
  pageCount: number;
  from: number; // 1-based index of the first item shown (0 when empty)
  to: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, size: number): Paged<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  return { slice, page: p, pageCount, from: total === 0 ? 0 : start + 1, to: start + slice.length, total };
}

/** Page buttons to show: first, last, and the neighbours of the current page, with "…" for gaps. */
export function pageNumbers(page: number, pageCount: number): (number | "…")[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1]);
  const nums = [...keep].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}
