/**
 * What Upload (app/upload/page.tsx) can send, and what it says when the
 * send fails.
 *
 * Vercel refuses a request body over 4.5MB before the scoring function
 * runs (413, FUNCTION_PAYLOAD_TOO_LARGE, a body that is not JSON), so
 * the 25MB the tile used to promise ended in "The scoring server didn't
 * answer." after the whole file had gone up. 4MB leaves room for the
 * form's other fields.
 */
export const UPLOAD_MAX_MB = 4;

export const UPLOAD_TOO_BIG = `That file is over ${UPLOAD_MAX_MB}MB. Trim it and try again.`;

export function uploadTooBig(bytes: number): boolean {
  return bytes > UPLOAD_MAX_MB * 1024 * 1024;
}

/** The line for a failed send, by its status and the route's own error, if it gave one. */
export function uploadFailure(status: number, error: string | null | undefined, maxMinutes: number): string {
  if (status === 413) return UPLOAD_TOO_BIG;
  if (error) return error;
  if (status === 504 || status === 502) {
    return `Scoring timed out. Files under about ${maxMinutes} minutes work; trim it and try again.`;
  }
  return "The scoring server didn't answer.";
}
