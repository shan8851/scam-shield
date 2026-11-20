/** Limits enforced by the gate. Sliding windows, counted from check rows. */
export const limits = {
  perSender: [
    { windowMinutes: 10, maxChecks: 5 },
    { windowMinutes: 24 * 60, maxChecks: 20 },
  ],
  global: { windowMinutes: 24 * 60, maxChecks: 50 },
} as const;
