/**
 * Compute canonical SHA-256 hash for Git-style content addressing
 */
export async function computeRevisionHash(data: unknown): Promise<string> {
  const jsonString = JSON.stringify(data, Object.keys(data as object).sort());
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
