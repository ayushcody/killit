/**
 * Cross-platform listPorts().
 * Delegates to the appropriate OS adapter, enriches with metadata + classification.
 */
import type { PortProcessInfo } from '../types.js'
import { listUnixListeningPorts, getUnixProcessMeta } from '../adapters/unix.js'
import { listWindowsListeningPorts, getWindowsProcessMeta } from '../adapters/windows.js'
import { classifyTarget } from './classify.js'
import { inferProjectType } from './infer.js'

export async function listPorts(): Promise<PortProcessInfo[]> {
  const isWindows = process.platform === 'win32'

  // Step 1: Get raw port entries from OS adapter
  const rawEntries = isWindows ? await listWindowsListeningPorts() : await listUnixListeningPorts()

  // Step 2: Enrich with metadata + safety classification
  const enriched: PortProcessInfo[] = []

  for (const entry of rawEntries) {
    // Get process metadata
    const meta: {
      processName?: string
      command?: string
      executablePath?: string
      owner?: string
    } = isWindows ? await getWindowsProcessMeta(entry.pid) : await getUnixProcessMeta(entry.pid)

    const processName = entry.processName ?? meta.processName
    const command = meta.command ?? entry.command
    const executablePath = entry.executablePath ?? meta.executablePath
    const owner = entry.owner ?? meta.owner

    // Classify safety
    const classification = classifyTarget({
      pid: entry.pid,
      port: entry.port,
      processName,
      executablePath,
      owner,
    })

    // Infer project type
    const projectType = inferProjectType(command ?? processName)

    enriched.push({
      port: entry.port,
      pid: entry.pid,
      protocol: entry.protocol,
      processName,
      command,
      executablePath,
      owner,
      projectType,
      safety: classification.safety,
      reasons: classification.reasons,
      riskReasons: classification.riskReasons,
    })
  }

  // Sort by port number
  enriched.sort((a, b) => a.port - b.port)

  return enriched
}
