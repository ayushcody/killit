/**
 * Kill engine — graceful-first termination with escalation.
 * Supports --tree (process group), --force (SIGKILL), --dry-run.
 */
import type { PortProcessInfo, KillOptions, KillOutcome } from '../types.js'
import { isAlive, sleep, getProcessGroup } from '../utils/signals.js'
import { windowsKill } from '../adapters/windows.js'

const isWindows = process.platform === 'win32'

export async function killResolvedTarget(
  info: PortProcessInfo,
  opts: KillOptions = {}
): Promise<KillOutcome> {
  const {
    force = false,
    graceMs = 1200,
    tree = false,
    dryRun = false,
    includeBlocked = false,
  } = opts

  // 0. System Protection Shield (Foolproofing)
  // Strictly prevent terminating core OS processes, shell connections, or our own running processes
  const protectedPids = new Set([0, 1, 2, process.pid, process.ppid])
  if (protectedPids.has(info.pid)) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'blocked',
      message: `System Protection: Terminating process PID ${info.pid} is strictly blocked to prevent session lockout or OS instability.`,
      riskReasons: ['SYSTEM_CRITICAL_PROCESS'],
    }
  }

  const procNameLower = (info.processName || '').toLowerCase()
  const protectedNames = new Set([
    'systemd',
    'launchd',
    'init',
    'bash',
    'zsh',
    'sh',
    'fish',
    'tmux',
    'screen',
    'cmd.exe',
    'powershell.exe',
    'explorer.exe',
    'sshd',
    'lsass.exe',
    'csrss.exe',
    'smss.exe',
    'wininit.exe',
    'services.exe',
    'svchost.exe',
  ])
  if (protectedNames.has(procNameLower)) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'blocked',
      message: `System Protection: Terminating system process "${info.processName}" (PID ${info.pid}) is strictly blocked to prevent terminal lockout or OS freeze.`,
      riskReasons: ['SYSTEM_CRITICAL_PROCESS'],
    }
  }

  // 1. Safety: blocked
  if (info.safety === 'blocked' && !includeBlocked) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'blocked',
      message: info.reasons.join('; '),
      riskReasons: info.riskReasons,
    }
  }

  // 2. Safety: warn without --force
  if (info.safety === 'warn' && !force) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'warned',
      message: `Warning: ${info.reasons.join('; ')}. Use --force to proceed.`,
      riskReasons: info.riskReasons,
    }
  }

  // 3. Dry run
  if (dryRun) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'killed', // report as would-be-killed
      message: `Dry run — would kill ${info.processName ?? 'unknown'} (PID ${info.pid})`,
      riskReasons: info.riskReasons,
    }
  }

  // 4. Check if still alive
  const alive = await isAlive(info.pid)
  if (!alive) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'already-exited',
      message: `Process PID ${info.pid} already exited`,
      riskReasons: info.riskReasons,
    }
  }

  // 5. Execute kill
  try {
    if (isWindows) {
      return await killWindows(info, force)
    } else {
      return await killUnix(info, { force, graceMs, tree })
    }
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException

    // 7. EPERM
    if (err.code === 'EPERM') {
      const hint = isWindows
        ? 'Run terminal as Administrator'
        : `Try: sudo killit kill ${info.port}`
      return {
        port: info.port,
        pid: info.pid,
        status: 'failed',
        message: `Permission denied — ${hint}`,
        riskReasons: info.riskReasons,
      }
    }

    // 8. ESRCH — process already gone (race condition)
    if (err.code === 'ESRCH') {
      return {
        port: info.port,
        pid: info.pid,
        status: 'already-exited',
        message: `Process PID ${info.pid} already exited`,
        riskReasons: info.riskReasons,
      }
    }

    return {
      port: info.port,
      pid: info.pid,
      status: 'failed',
      message: err.message || 'Unknown error during kill',
      riskReasons: info.riskReasons,
    }
  }
}

async function killUnix(
  info: PortProcessInfo,
  opts: { force: boolean; graceMs: number; tree: boolean }
): Promise<KillOutcome> {
  const { force, graceMs, tree } = opts

  // Send SIGTERM
  if (tree) {
    const pgid = await getProcessGroup(info.pid)
    process.kill(-pgid, 'SIGTERM')
  } else {
    process.kill(info.pid, 'SIGTERM')
  }

  // Poll for process termination up to graceMs (faster, non-blocking)
  const pollInterval = 50
  const maxPolls = Math.max(1, Math.floor(graceMs / pollInterval))
  let stillAlive = true
  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollInterval)
    stillAlive = await isAlive(info.pid)
    if (!stillAlive) break
  }

  if (!stillAlive) {
    return {
      port: info.port,
      pid: info.pid,
      status: 'killed',
      message: `Killed ${info.processName ?? 'unknown'} (PID ${info.pid})`,
      signalSent: 'SIGTERM',
      riskReasons: info.riskReasons,
    }
  }

  // Escalate to SIGKILL if --force
  if (force) {
    try {
      if (tree) {
        const pgid = await getProcessGroup(info.pid)
        process.kill(-pgid, 'SIGKILL')
      } else {
        process.kill(info.pid, 'SIGKILL')
      }
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException
      if (err.code === 'ESRCH') {
        return {
          port: info.port,
          pid: info.pid,
          status: 'killed',
          message: `Killed ${info.processName ?? 'unknown'} (PID ${info.pid})`,
          signalSent: 'SIGKILL',
          riskReasons: info.riskReasons,
        }
      }
      throw e
    }

    // Poll up to 500ms for SIGKILL death verification
    let deadAfterKill = false
    for (let i = 0; i < 10; i++) {
      await sleep(50)
      const aliveCheck = await isAlive(info.pid)
      if (!aliveCheck) {
        deadAfterKill = true
        break
      }
    }

    return {
      port: info.port,
      pid: info.pid,
      status: deadAfterKill ? 'killed' : 'failed',
      message: deadAfterKill
        ? `Killed ${info.processName ?? 'unknown'} (PID ${info.pid})`
        : `Process PID ${info.pid} still alive after SIGKILL`,
      signalSent: 'SIGKILL',
      riskReasons: info.riskReasons,
    }
  }

  // Not force — tell user to use --force
  return {
    port: info.port,
    pid: info.pid,
    status: 'failed',
    message: `Process PID ${info.pid} alive after SIGTERM — use --force to escalate to SIGKILL`,
    signalSent: 'SIGTERM',
    riskReasons: info.riskReasons,
  }
}

async function killWindows(info: PortProcessInfo, force: boolean): Promise<KillOutcome> {
  const result = await windowsKill(info.pid, { force, tree: true })

  return {
    port: info.port,
    pid: info.pid,
    status: result.success ? 'killed' : 'failed',
    message: result.success
      ? `Killed ${info.processName ?? 'unknown'} (PID ${info.pid})`
      : result.message,
    signalSent: force ? 'SIGKILL' : 'SIGTERM',
    riskReasons: info.riskReasons,
  }
}
