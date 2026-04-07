const SESSION_KEY = 'tr_seat_session_id'

/**
 * Get or create a stable session ID for this browser tab.
 * Stored in sessionStorage so it persists within the same tab
 * but resets when the tab is closed (prevents stale locks).
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}
