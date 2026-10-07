"use client";

import { useState } from "react";

export function CopyButton({ text, label, done, className = "btn btn-secondary btn-sm" }: { text: string; label: string; done: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt(label, text);
        }
      }}
    >
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
