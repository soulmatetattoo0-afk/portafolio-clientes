"use client";

import { useTransition, type FormEvent } from "react";

/**
 * Submit a form to a useActionState dispatcher without React's automatic form
 * reset, so a validation error never wipes what the person typed.
 */
export function useSubmit(dispatch: (form: FormData) => void) {
  const [, start] = useTransition();
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(() => dispatch(form));
  };
}
