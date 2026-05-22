/**
 * Output parsers for OS-specific port listing tools.
 * Each parser converts raw command output into RawPortEntry[].
 */
import type { RawPortEntry } from '../types.js'

/**
 * Parse lsof -F pcn output.
 * Tags: p=PID, c=processName, n=address:port
 * New block starts with 'p' tag.
 */
export function parseLsofOutput(output: string): RawPortEntry[] {
  const entries: RawPortEntry[] = []
  const lines = output.split('\n')

  let currentPid = 0
  let currentName = ''

  for (const line of lines) {
    if (!line) continue

    const tag = line[0]
    const value = line.slice(1)

    switch (tag) {
      case 'p':
        currentPid = parseInt(value, 10)
        break
      case 'c':
        currentName = value
        break
      case 'n': {
        // format: address:port or *:port
        const colonIdx = value.lastIndexOf(':')
        if (colonIdx === -1) continue
        const portStr = value.slice(colonIdx + 1)
        const port = parseInt(portStr, 10)
        if (isNaN(port) || port < 1 || port > 65535) continue

        entries.push({
          port,
          pid: currentPid,
          protocol: 'tcp',
          processName: currentName || undefined,
        })
        break
      }
    }
  }

  // Deduplicate by port+pid
  return deduplicateEntries(entries)
}

/**
 * Parse ss -tlnp output.
 * Example line: LISTEN  0  128  0.0.0.0:3000  0.0.0.0:*  users:(("node",pid=1234,fd=18))
 */
export function parseSsOutput(output: string): RawPortEntry[] {
  const entries: RawPortEntry[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    if (!line.startsWith('LISTEN')) continue

    // Extract local address (4th column)
    const parts = line.split(/\s+/)
    if (parts.length < 5) continue

    const localAddr = parts[3]
    const port = extractPortFromAddress(localAddr)
    if (!port) continue

    // Extract PID from users:((...,pid=NNNN,...))
    // Example: users:(("node",pid=1234,fd=18),("node",pid=5678,fd=19))
    const usersMatch = line.match(/users:\((.+)\)/)
    if (usersMatch) {
      const usersStr = usersMatch[1]
      // Match all blocks in format ("name",pid=123,fd=4)
      const userBlocks = usersStr.match(/\("[^"]+",pid=\d+,fd=\d+\)/g)
      if (userBlocks) {
        for (const block of userBlocks) {
          const pidM = block.match(/pid=(\d+)/)
          const nameM = block.match(/"([^"]+)"/)
          if (pidM) {
            entries.push({
              port,
              pid: parseInt(pidM[1], 10),
              protocol: 'tcp',
              processName: nameM?.[1] || undefined,
            })
          }
        }
      } else {
        // Fallback for single match format without quotes or comma
        const pidM = usersStr.match(/pid=(\d+)/)
        const nameM = usersStr.match(/"([^"]+)"/)
        if (pidM) {
          entries.push({
            port,
            pid: parseInt(pidM[1], 10),
            protocol: 'tcp',
            processName: nameM?.[1] || undefined,
          })
        }
      }
    } else {
      // General regex fallback at line level
      const pidMatch = line.match(/pid=(\d+)/)
      const nameMatch = line.match(/\("([^"]+)"/)

      if (pidMatch) {
        entries.push({
          port,
          pid: parseInt(pidMatch[1], 10),
          protocol: 'tcp',
          processName: nameMatch?.[1] || undefined,
        })
      }
    }
  }

  return deduplicateEntries(entries)
}

/**
 * Parse /proc/net/tcp and /proc/net/tcp6.
 * Column 1: local_address = hex "0100007F:0BB8"
 * Last 4 hex chars = port: parseInt("0BB8", 16) = 3000
 * Column 3: st = "0A" means TCP_LISTEN
 * Column 9: inode number
 */
export function parseProcNetTcp(content: string): Array<{ port: number; inode: string }> {
  const results: Array<{ port: number; inode: string }> = []
  const lines = content.trim().split('\n').slice(1) // skip header

  for (const line of lines) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 10) continue

    const localAddress = fields[1]
    const state = fields[3]

    // 0A = TCP_LISTEN
    if (state !== '0A') continue

    const colonIdx = localAddress.lastIndexOf(':')
    if (colonIdx === -1) continue

    const hexPort = localAddress.slice(colonIdx + 1)
    const port = parseInt(hexPort, 16)

    if (isNaN(port) || port < 1 || port > 65535) continue

    const inode = fields[9]
    results.push({ port, inode })
  }

  return results
}

/**
 * Parse Windows netstat -ano -p tcp output.
 * Handles both IPv4 (0.0.0.0:3000) and IPv6 ([::]:3000) rows.
 */
export function parseNetstatOutput(output: string): RawPortEntry[] {
  const entries: RawPortEntry[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.includes('LISTENING')) continue

    const parts = trimmed.split(/\s+/)
    if (parts.length < 5) continue

    // Protocol  Local Address  Foreign Address  State  PID
    const localAddr = parts[1]
    const pid = parseInt(parts[parts.length - 1], 10)

    const port = extractPortFromAddress(localAddr)
    if (!port || isNaN(pid)) continue

    entries.push({
      port,
      pid,
      protocol: 'tcp',
    })
  }

  return deduplicateEntries(entries)
}

/**
 * Extract port number from address strings like:
 * - 0.0.0.0:3000
 * - [::]:3000
 * - 127.0.0.1:8080
 * - [::1]:8080
 */
function extractPortFromAddress(addr: string): number | null {
  // Handle IPv6 bracket notation [::]:port
  const bracketMatch = addr.match(/\]:(\d+)$/)
  if (bracketMatch) {
    const port = parseInt(bracketMatch[1], 10)
    return port >= 1 && port <= 65535 ? port : null
  }

  // Handle IPv4 or bare address:port
  const colonIdx = addr.lastIndexOf(':')
  if (colonIdx === -1) return null

  const port = parseInt(addr.slice(colonIdx + 1), 10)
  return port >= 1 && port <= 65535 ? port : null
}

/** Deduplicate RawPortEntry[] by port+pid. */
function deduplicateEntries(entries: RawPortEntry[]): RawPortEntry[] {
  const seen = new Set<string>()
  return entries.filter(e => {
    const key = `${e.port}:${e.pid}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
