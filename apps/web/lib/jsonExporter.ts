import { OpenLyricsDocument } from '@/types/lyrics';

/**
 * Formats OpenLyricsDocument object to pretty-printed JSON string
 */
export function exportJSON(doc: OpenLyricsDocument): string {
  return JSON.stringify(doc, null, 2);
}
