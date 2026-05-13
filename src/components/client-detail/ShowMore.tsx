"use client";

import { useState } from "react";

const PREVIEW = 5;

/**
 * Renders the first PREVIEW children, and a "Show X more" toggle if there are
 * more. Toggles between collapsed/expanded on click.
 */
export function ShowMore({
  children,
  initial = PREVIEW,
}: {
  children: React.ReactNode[];
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = children.length;
  const visible = expanded ? children : children.slice(0, initial);
  const hidden = total - initial;

  return (
    <>
      {visible}
      {hidden > 0 ? (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-auto w-full rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      ) : null}
    </>
  );
}
