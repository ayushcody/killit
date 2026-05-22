/**
 * Windows adapter — netstat + PowerShell Get-Process.
 * NEVER uses wmic (deprecated, disabled in Windows 11+).
 */
import { run } from '../utils/exec.js'
import { parseNetstatOutput } from '../utils/parse.js'
import type { RawPortEntry } from '../types.js'

/**
 * List all listening TCP ports on Windows.
 * Uses netstat -ano -p tcp.
 * Note: shell: true is required for netstat on Windows (documented exception).
 */
export async function listWindowsListeningPorts(): Promise<RawPortEntry[]> {
  const result = await run('netstat', ['-ano', '-p', 'tcp'], { shell: true })
  if (result.exitCode !== 0) return []
  return parseNetstatOutput(result.stdout)
}

/**
 * Get process metadata using PowerShell Get-Process.
 * Returns processName, executablePath, and attempts owner lookup.
 */
export async function getWindowsProcessMeta(pid: number): Promise<{
  processName?: string
  executablePath?: string
  owner?: string
}> {
  const meta: { processName?: string; executablePath?: string; owner?: string } = {}

  try {
    const psCmd = `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path | ConvertTo-Json`
    const result = await run('powershell', ['-NoProfile', '-Command', psCmd])

    if (result.exitCode === 0 && result.stdout.trim()) {
      try {
        const data = JSON.parse(result.stdout.trim())
        meta.processName = data.ProcessName || undefined
        meta.executablePath = data.Path || undefined
      } catch {
        // JSON parse failed
      }
    }
  } catch {
    // PowerShell unavailable
  }

  // Owner lookup via Get-Process with IncludeUserName (requires elevation)
  try {
    const ownerCmd = `(Get-Process -Id ${pid} -IncludeUserName -ErrorAction SilentlyContinue).UserName`
    const result = await run('powershell', ['-NoProfile', '-Command', ownerCmd])
    if (result.exitCode === 0 && result.stdout.trim()) {
      meta.owner = result.stdout.trim()
    }
  } catch {
    // elevation required — owner unavailable
  }

  return meta
}

/**
 * Kill a process on Windows using taskkill.
 * Supports /T for tree kill and /F for force.
 */
export async function windowsKill(
  pid: number,
  options: { force?: boolean; tree?: boolean } = {}
): Promise<{ success: boolean; message: string }> {
  const args = ['/PID', String(pid)]

  if (options.tree !== false) {
    args.push('/T') // always tree kill by default on Windows
  }

  if (options.force) {
    args.push('/F')
  }

  const result = await run('taskkill', args, { shell: true })

  if (result.exitCode === 0) {
    return { success: true, message: `taskkill PID ${pid}` }
  }

  return {
    success: false,
    message: result.stderr.trim() || result.stdout.trim() || `taskkill failed for PID ${pid}`,
  }
}
