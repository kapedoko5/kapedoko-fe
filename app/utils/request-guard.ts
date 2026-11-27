/**
 * Sequence guard for async loads: only the latest request may write results.
 * `next()` starts a request and returns a check that turns false as soon as a
 * newer request starts, so stale (out-of-order) responses can be dropped.
 */
export function createRequestGuard() {
  let latest = 0
  return {
    next() {
      latest += 1
      const mine = latest
      return () => mine === latest
    },
  }
}
