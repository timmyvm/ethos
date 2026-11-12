/**
 * What a form field may carry into a row (#457, the security sweep). A
 * route stores some of what a phone sends; a field the app wrote is
 * checked against what the app writes, so a NUL, a control character or
 * a megabyte never reaches Postgres (a NUL fails the insert outright).
 */
/** A form's id, or nothing: the app's ids only, 120 characters at most (#457). */
export function cleanId(raw: FormDataEntryValue | null): string | undefined {
  return typeof raw === "string" && /^[\w:.\-]{1,120}$/.test(raw) ? raw : undefined;
}

/** Text a person sees again, without control characters, cut to `max` (#457). */
export function cleanText(raw: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}
