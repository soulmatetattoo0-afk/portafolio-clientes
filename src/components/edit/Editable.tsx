"use client";

import { useEdit, type EditSpec } from "./EditContext";

/**
 * Something on the page the artist can change. On the public page it is just
 * its children; on the artist's own copy a pencil sits in the corner, and a
 * tap on it opens the sheet for exactly this thing.
 */
export function Editable({ spec, children, className = "", corner = "tr", size = "md" }: { spec: EditSpec | (() => EditSpec); children: React.ReactNode; className?: string; corner?: "tr" | "tl" | "br" | "bl"; size?: "sm" | "md" }) {
  const edit = useEdit();
  if (!edit?.on) return <>{children}</>;
  const at = { tr: "right-2 top-2", tl: "left-2 top-2", br: "right-2 bottom-2", bl: "left-2 bottom-2" }[corner];
  return (
    <div className={`relative ${className}`}>
      {children}
      <button
        type="button"
        aria-label={edit.labels.edit}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          edit.open(typeof spec === "function" ? spec() : spec);
        }}
        className={`ed-pencil absolute ${at} ${size === "sm" ? "h-8 w-8" : "h-10 w-10"}`}
      >
        <Pencil />
      </button>
    </div>
  );
}

/** A round button for an action in edit mode (add photos, add a city). */
export function EditAction({ label, onClick, href, className = "" }: { label: string; onClick?: () => void; href?: string; className?: string }) {
  const edit = useEdit();
  if (!edit?.on) return null;
  const cls = `ed-action ${className}`;
  return href ? (
    <a href={href} className={cls}>
      <Pencil /> {label}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      <Pencil /> {label}
    </button>
  );
}

function Pencil() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.05em] w-[1.05em]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}
