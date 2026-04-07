/**
 * Format a date string in WIB (Asia/Jakarta) timezone
 * Indonesia uses UTC+7 (WIB/Waktu Indonesia Barat)
 */

const TIMEZONE = 'Asia/Jakarta'

export function formatEventDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  })
}

export function formatEventTime(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  })
}

export function formatEventDateTime(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  })
}

export function formatShortDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  })
}
