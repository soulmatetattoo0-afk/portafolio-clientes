"use client";

import { useActionState, useState } from "react";

import { createStudio, type OnboardingState } from "./actions";
import { useSubmit } from "@/components/useSubmit";

const toSlug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function OnboardingForm({ labels, timezones }: { labels: Record<"name" | "slug" | "slugHint" | "city" | "timezone" | "create", string>; timezones: string[] }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createStudio, { error: null });
  const onSubmit = useSubmit(action);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-1.5">
        <label htmlFor="ob-name" className="t-label">
          {labels.name}
        </label>
        <input
          id="ob-name"
          name="name"
          required
          maxLength={80}
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(toSlug(e.target.value));
          }}
          aria-invalid={state.field === "name"}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="ob-slug" className="t-label">
          {labels.slug}
        </label>
        <div className="flex items-center rounded-[var(--radius-sm)] border border-line-strong focus-within:border-gilt">
          <span className="pl-3 text-ash-dim">/</span>
          <input
            id="ob-slug"
            name="slug"
            required
            maxLength={40}
            className="input border-0 pl-1 focus:shadow-none"
            value={slug}
            onChange={(e) => {
              setSlug(toSlug(e.target.value));
              setSlugEdited(true);
            }}
            aria-invalid={state.field === "slug"}
            aria-describedby="ob-slug-hint ob-error"
          />
        </div>
        <p id="ob-slug-hint" className="text-[0.85rem] text-ash-dim">
          {labels.slugHint}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="ob-city" className="t-label">
            {labels.city}
          </label>
          <input id="ob-city" name="city" required maxLength={80} autoComplete="address-level2" className="input" aria-invalid={state.field === "city"} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="ob-tz" className="t-label">
            {labels.timezone}
          </label>
          <select id="ob-tz" name="timezone" className="input" defaultValue="America/New_York">
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id="ob-error" role="alert" className={`text-[0.88rem] text-oxblood ${state.error ? "" : "hidden"}`}>
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary sm:w-fit" disabled={pending}>
        {labels.create}
      </button>
    </form>
  );
}
