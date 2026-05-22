/**
 * Unix adapter — macOS + Linux.
 * Linux fallback chain: ss → lsof → /proc/net/tcp direct parse.
 */
import fs from 'node:fs'
import path from 'node:path'
import { run } from '../utils/exec.js'
import { parseLsofOutput, parseSsOutput, parseProcNetTcp } from '../utils/parse.js'
import type { RawPortEntry } from '../types.js'

/**
 * Detect if we're on macOS or Linux.
 */
function isMacOS(): boolean {
  return process.platform === 'darwin'
}

/**
 * List all listening TCP ports on Unix.
 * macOS: always uses lsof (ships natively).
 * Linux: ss → lsof → /proc/net/tcp fallback chain.
 */
export async function listUnixListeningPorts(): Promise<RawPortEntry[]> {
  if (isMacOS()) {
    return listViaLsof()
  }

  // Linux fallback chain
  const ssResult = await listViaSs()
  if (ssResult !== null) return ssResult

  const lsofResult = await listViaLsofFallback()
  if (lsofResult !== null) return lsofResult

  return listViaProc()
}

/**
 * Get process metadata on Unix using ps.
 */
export async function getUnixProcessMeta(pid: number): Promise<{
  owner?: string
  command?: string
  executablePath?: string
}> {
  const meta: { owner?: string; command?: string; executablePath?: string } = {}

  try {
    const result = await run('ps', ['-p', String(pid), '-o', 'user=,comm=,args='])
    if (result.exitCode === 0 && result.stdout.trim()) {
      const line = result.stdout.trim()
      // user is first field, comm is second, rest is args
      const parts = line.split(/\s+/)
      if (parts.length >= 1) meta.owner = parts[0]
      if (parts.length >= 2) meta.command = parts.slice(2).join(' ') || parts[1]
    }
  } catch {
    // ps failed — metadata unavailable
  }

  // Try /proc/<pid>/exe for executable path (Linux only)
  try {
    meta.executablePath = fs.readlinkSync(`/proc/${pid}/exe`)
  } catch {
    // Not on Linux or permission denied — try macOS fallback
    if (isMacOS()) {
      try {
        const result = await run('ps', ['-p', String(pid), '-o', 'comm='])
        if (result.exitCode === 0 && result.stdout.trim()) {
          meta.executablePath = result.stdout.trim()
        }
      } catch {
        // unavailable
      }
    }
  }

  return meta
}

// ── Internal helpers ──────────────────────────────────────────

/** macOS: lsof is always available. Use machine-readable -F format. */
async function listViaLsof(): Promise<RawPortEntry[]> {
  const result = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcn'])
  if (result.exitCode !== 0) return []
  return parseLsofOutput(result.stdout)
}

/** Linux first try: ss (iproute2 — present on modern distros). */
async function listViaSs(): Promise<RawPortEntry[] | null> {
  const result = await run('ss', ['-tlnp'])
  if (result.exitCode !== null && result.exitCode !== 0) return null
  if (result.stderr.includes('not found') || result.stderr.includes('No such file')) return null
  if (!result.stdout.trim()) return null
  return parseSsOutput(result.stdout)
}

/** Linux second try: lsof (if installed). */
async function listViaLsofFallback(): Promise<RawPortEntry[] | null> {
  const result = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcn'])
  if (result.exitCode !== null && result.exitCode !== 0) return null
  if (result.stderr.includes('not found') || result.stderr.includes('No such file')) return null
  if (!result.stdout.trim()) return null
  return parseLsofOutput(result.stdout)
}

/**
 * Linux last resort: direct /proc/net/tcp parse.
 * Works in Docker Alpine with ZERO external tool dependency.
 * 1. Parse /proc/net/tcp + /proc/net/tcp6 for listening sockets
 * 2. Match socket inode → PID by scanning /proc/<pid>/fd/ symlinks
 * 3. Read process name from /proc/<pid>/status
 */
function listViaProc(): RawPortEntry[] {
  const entries: RawPortEntry[] = []
  const listeners: Array<{ port: number; inode: string }> = []

  // Read both tcp and tcp6
  for (const tcpFile of ['/proc/net/tcp', '/proc/net/tcp6']) {
    try {
      const content = fs.readFileSync(tcpFile, 'utf-8')
      listeners.push(...parseProcNetTcp(content))
    } catch {
      // File might not exist
    }
  }

  if (listeners.length === 0) return []

  // Build inode → port map
  const inodeToPort = new Map<string, number>()
  for (const l of listeners) {
    inodeToPort.set(l.inode, l.port)
  }

  // Scan all numeric /proc entries for PIDs
  let procEntries: string[]
  try {
    procEntries = fs.readdirSync('/proc').filter(e => /^\d+$/.test(e))
  } catch {
    return []
  }

  for (const pidStr of procEntries) {
    const pid = parseInt(pidStr, 10)
    const fdDir = path.join('/proc', pidStr, 'fd')

    let fdEntries: string[]
    try {
      fdEntries = fs.readdirSync(fdDir)
    } catch {
      continue // Permission denied or process exited
    }

    for (const fd of fdEntries) {
      try {
        const target = fs.readlinkSync(path.join(fdDir, fd))
        // Format: socket:[inode]
        const match = target.match(/^socket:\[(\d+)\]$/)
        if (!match) continue

        const inode = match[1]
        const port = inodeToPort.get(inode)
        if (port === undefined) continue

        // Read process name from /proc/<pid>/status
        let processName: string | undefined
        try {
          const status = fs.readFileSync(`/proc/${pid}/status`, 'utf-8')
          const nameMatch = status.match(/^Name:\s+(.+)$/m)
          if (nameMatch) processName = nameMatch[1].trim()
        } catch {
          // ignore
        }

        // Read executable path
        let executablePath: string | undefined
        try {
          executablePath = fs.readlinkSync(`/proc/${pid}/exe`)
        } catch {
          // ignore
        }

        // Read owner from /proc/<pid>/status Uid field
        let owner: string | undefined
        try {
          const status = fs.readFileSync(`/proc/${pid}/status`, 'utf-8')
          const uidMatch = status.match(/^Uid:\s+(\d+)/m)
          if (uidMatch) {
            const uid = uidMatch[1]
            owner = getUsernameFromUid(uid)
          }
        } catch {
          // ignore
        }

        entries.push({
          port,
          pid,
          protocol: 'tcp',
          processName,
          executablePath,
          owner,
        })
      } catch {
        continue
      }
    }
  }

  // Deduplicate by port+pid
  const seen = new Set<string>()
  return entries.filter(e => {
    const key = `${e.port}:${e.pid}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

let uidToUserMap: Map<string, string> | null = null

function getUsernameFromUid(uid: string): string {
  if (uid === '0') return 'root'
  if (!uidToUserMap) {
    uidToUserMap = new Map()
    try {
      const passwd = fs.readFileSync('/etc/passwd', 'utf-8')
      for (const line of passwd.split('\n')) {
        const parts = line.split(':')
        if (parts.length >= 3) {
          uidToUserMap.set(parts[2], parts[0])
        }
      }
    } catch {
      // ignore
    }
  }
  return uidToUserMap.get(uid) || `uid:${uid}`
}
