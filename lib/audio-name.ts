/**
 * A recording's file name as Ethos stores it (lib/db.ts saveRep) and
 * sends it to be transcribed (app/api/analyze): "rep" and its extension,
 * which the transcription service reads the format from, never the name
 * it was picked with. An upload's camera-roll name can be a person's
 * ("Jane Doe interview.mp4"), and neither place needs it (review P3).
 */
export function neutralAudioName(name: string | null | undefined): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name ?? "")?.[1]?.toLowerCase();
  return `rep.${ext ?? "webm"}`;
}
