/** Limits enforced by the gate. Sliding windows, counted from check rows. */
export const limits = {
  perSender: [
    { windowMinutes: 10, maxChecks: 5 },
    { windowMinutes: 24 * 60, maxChecks: 20 },
  ],
  global: { windowMinutes: 24 * 60, maxChecks: 50 },
  /**
   * What one check can carry. Cool-offs count checks, not messages, so
   * without this one burst could hold any number of screenshots, and the
   * token cap only applies after the first model call has been paid for.
   * Messages past the cap are dropped and the sender is told.
   */
  batch: { maxImages: 6, maxTextChars: 10_000 },
} as const;
