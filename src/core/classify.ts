/**
 * Safety classifier — the moat.
 * Determines whether a port process is safe to kill, should warn, or is hard-blocked.
 *
 * CRITICAL FIX: Unknown metadata (null executable + owner + name) → 'warn', NOT 'safe'.
 */
import type { SafetyLevel } from '../types.js'

interface ClassifyResult {
  safety: SafetyLevel
  reasons: string[]
  riskReasons: string[]
}

export function classifyTarget(info: {
  pid: number
  port: number
  processName?: string
  executablePath?: string
  owner?: string
}): ClassifyResult {
  // ── HARD BLOCKS ──────────────────────────────────────────
  // PID 1: launchd / init / systemd — kernel's first process
  if (info.pid === 1) {
    return {
      safety: 'blocked',
      reasons: ['PID 1 — kernel first process (init/systemd/launchd)'],
      riskReasons: ['pid_1'],
    }
  }

  // PID 4 + "System" on Windows — http.sys kernel driver
  if (info.pid === 4 && info.processName?.toLowerCase() === 'system') {
    return {
      safety: 'blocked',
      reasons: ['Windows System (http.sys) — run: net stop http'],
      riskReasons: ['win_system_pid4'],
    }
  }

  // Linux kernel thread pattern: [kworker/0:0], [ksoftirqd], etc.
  if (/^\[.+\]$/.test(info.processName ?? '')) {
    return {
      safety: 'blocked',
      reasons: ['Linux kernel thread'],
      riskReasons: ['kernel_thread'],
    }
  }

  // ── WARN TRIGGERS (accumulate) ───────────────────────────
  const reasons: string[] = []
  const riskReasons: string[] = []

  // Privileged port
  if (info.port < 1024) {
    reasons.push('Privileged port (<1024)')
    riskReasons.push('privileged_port')
  }

  // System directory binary
  const SYSTEM_PATHS = ['/System/', '/usr/lib/systemd/', '/sbin/', 'C:\\Windows\\System32']
  if (info.executablePath && SYSTEM_PATHS.some(p => info.executablePath!.startsWith(p))) {
    reasons.push('Binary in system directory')
    riskReasons.push('system_path')
  }

  // Elevated/system user
  const SYSTEM_OWNERS = ['root', 'system', 'nt authority\\system']
  if (info.owner && SYSTEM_OWNERS.includes(info.owner.toLowerCase())) {
    reasons.push('Owned by elevated/system user')
    riskReasons.push('system_owner')
  }

  // Docker proxy — stop the container instead
  if (info.processName === 'docker-proxy') {
    reasons.push('Docker proxy — stop the container instead')
    riskReasons.push('docker_proxy')
  }

  // CRITICAL: unknown metadata = unknown risk (NOT safe)
  // If executable path AND owner AND processName are ALL null/undefined
  if (!info.executablePath && !info.owner && !info.processName) {
    reasons.push('Metadata unavailable — unknown risk')
    riskReasons.push('unknown_metadata')
  }

  if (reasons.length > 0) {
    return { safety: 'warn', reasons, riskReasons }
  }

  // ── SAFE: only when none of the above matched ────────────
  return {
    safety: 'safe',
    reasons: ['No system-risk indicators'],
    riskReasons: [],
  }
}
