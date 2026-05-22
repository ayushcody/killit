/**
 * Strict port validation — every code path accepting port input MUST use this.
 * Rejects non-numeric, out-of-range, and fractional values.
 */
export function parsePort(value: string): number {
  const trimmed = value.trim()

  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid port "${value}" — must be a positive integer`)
  }

  const port = Number(trimmed)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port ${value} out of range — must be between 1 and 65535`)
  }

  return port
}
