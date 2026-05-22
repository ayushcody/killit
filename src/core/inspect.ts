/**
 * inspectPort() — returns ARRAY (multiple processes can share a port via dual-stack).
 * Deduplicates by PID.
 */
import type { PortProcessInfo } from '../types.js'
import { listPorts } from './list.js'

export async function inspectPort(port: number): Promise<PortProcessInfo[]> {
  const allPorts = await listPorts()
  const matches = allPorts.filter(p => p.port === port)

  // Deduplicate by PID
  const seen = new Set<number>()
  return matches.filter(m => {
    if (seen.has(m.pid)) return false
    seen.add(m.pid)
    return true
  })
}
