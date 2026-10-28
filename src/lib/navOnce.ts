let last = 0;

/**
 * Run a navigation unless another one started in the last 700 ms, so a double tap
 * can't open the same screen twice.
 */
export function navOnce(go: () => void): void {
  const now = Date.now();
  if (now - last < 700) return;
  last = now;
  go();
}
