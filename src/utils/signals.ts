/**
 * Process signal utilities.
 */
import fs from 'node:fs'
import { run } from './exec.js'

/**
 * Check if a process is alive — does NOT kill it.
 * Uses process.kill(pid, 0) which sends signal 0 (existence check).
 * Catches ESRCH (no such process).
 */
export async function isAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ESRCH') return false
    // EPERM means the process exists but we don't have permission
    if (err.code === 'EPERM') return true
    throw e
  }
}

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get process group ID.
 * - Linux: parse /proc/<pid>/stat — field 5 is pgid
 * - macOS: ps -o pgid= -p <pid>
 * - Windows: return pid (taskkill /T handles the tree)
 */
export async function getProcessGroup(pid: number): Promise<number> {
  const platform = process.platform

  if (platform === 'win32') {
    return pid // taskkill /T handles tree on Windows
  }

  // Try /proc first (Linux)
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf-8')
    const lastParen = stat.lastIndexOf(')')
    if (lastParen !== -1) {
      const rest = stat.slice(lastParen + 2) // Skip ") "
      const fields = rest.split(' ')
      // Sliced fields: fields[0] is state, fields[1] is ppid, fields[2] is pgrp (pgid)
      if (fields.length > 2) {
        const pgid = parseInt(fields[2], 10)
        if (!isNaN(pgid) && pgid > 0) return pgid
      }
    }
  } catch {
    // /proc not available — try macOS fallback
  }

  // macOS fallback: ps
  try {
    const result = await run('ps', ['-o', 'pgid=', '-p', String(pid)])
    const pgid = parseInt(result.stdout.trim(), 10)
    if (!isNaN(pgid) && pgid > 0) return pgid
  } catch {
    // Fallback to pid itself
  }

  return pid
}
