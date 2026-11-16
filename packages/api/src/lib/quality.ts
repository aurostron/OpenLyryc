import { OpenLyricsDocument } from '@openlyryc/schema';

/**
 * Quality Score Algorithm: Q = (S * 0.50) + (C * 0.30) + (R * 0.20)
 * S: Sync Precision Score (chronological ordering, positive non-zero durations)
 * C: Completeness Score (line density relative to track duration)
 * R: Reviewer Confidence (voter reputation weight)
 */
export function calculateQualityScore(doc: OpenLyricsDocument, voterReputationSum = 100): number {
  const lines = doc.lines || [];
  if (lines.length === 0) return 0.0;

  // 1. Sync Precision (S)
  let precisionErrors = 0;
  let prevStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.start < prevStart) {
      precisionErrors += 2; // Out of order timestamp
    }
    if (line.end <= line.start) {
      precisionErrors += 1; // Zero or negative duration
    }
    prevStart = line.start;

    // Check token timestamps if present
    if (line.tokens && line.tokens.length > 0) {
      let prevTokenStart = line.start;
      for (const token of line.tokens) {
        if (token.start < prevTokenStart || token.end < token.start) {
          precisionErrors += 0.5;
        }
        prevTokenStart = token.start;
      }
    }
  }

  const syncPrecisionScore = Math.max(0, 100 - precisionErrors * 5) / 100;

  // 2. Completeness Score (C)
  const duration = doc.metadata.duration || 180;
  const lineCount = lines.length;
  // Estimate expected line count (approx 1 line every 5-10s for average song)
  const expectedMinLines = Math.max(5, Math.floor(duration / 15));
  const completenessScore = Math.min(1.0, lineCount / expectedMinLines);

  // 3. Reviewer Confidence (R)
  const approvalThreshold = 100;
  const reviewerConfidence = Math.min(1.0, voterReputationSum / approvalThreshold);

  // Final Weighted Quality Score Q
  const Q = (syncPrecisionScore * 0.50) + (completenessScore * 0.30) + (reviewerConfidence * 0.20);
  return Math.round(Q * 100) / 100; // 0.00 to 1.00
}
