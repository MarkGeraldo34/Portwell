"use client";

import { useEffect, useState } from "react";
import { filterItems, pageNumbers, paginate, type Paged } from "@/lib/list-tools";

/** Search box + page state for one list. Typing resets to page 1. */
export function useListTools<T>(items: T[], textOf: (item: T) => string, size: number) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = filterItems(items, query, textOf);
  const paged: Paged<T> = paginate(filtered, page, size);
  useEffect(() => setPage(1), [query]);
  return { query, setQuery, setPage, filtered, paged, searching: query.trim().length > 0 };
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="searchbar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" className="searchbar-clear" onClick={() => onChange("")} aria-label="Clear search" title="Clear">
          ×
        </button>
      )}
    </div>
  );
}

/** "Showing 1–6 of 23 strategies" with page buttons. Without onPage it is a plain summary. */
export function PaginationSummary({ paged, noun, onPage, note }: { paged: Pick<Paged<unknown>, "page" | "pageCount" | "from" | "to" | "total">; noun: string; onPage?: (p: number) => void; note?: string }) {
  const { page, pageCount, from, to, total } = paged;
  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager-summary">
        {total === 0 ? (
          <>No {noun} to show</>
        ) : (
          <>
            Showing <b>{from}–{to}</b> of <b>{total}</b> {noun}
          </>
        )}
        <span className="pager-page"> · Page {page} of {pageCount}</span>
        {note && <span className="pager-page"> · {note}</span>}
      </p>
      {onPage && pageCount > 1 && (
        <div className="pager-btns">
          <button className="pager-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
          {pageNumbers(page, pageCount).map((n, i) =>
            n === "…" ? (
              <span key={`gap${i}`} className="pager-gap">…</span>
            ) : (
              <button key={n} className={`pager-btn${n === page ? " on" : ""}`} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
                {n}
              </button>
            ),
          )}
          <button className="pager-btn" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
        </div>
      )}
    </nav>
  );
}
