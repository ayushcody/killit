/**
 * CLI output formatting.
 * Uses chalk for colored table output. Respects --no-color and --json.
 */
import chalk from 'chalk'
import type { PortProcessInfo, KillOutcome } from '../types.js'

/**
 * Render the `killit list` table.
 */
export function formatListTable(entries: PortProcessInfo[]): string {
  if (entries.length === 0) {
    return chalk.dim('  No listening ports found.')
  }

  const header = chalk.bold(
    `  ${'PORT'.padEnd(7)}${'PID'.padEnd(8)}${'TYPE'.padEnd(6)}${'NAME'.padEnd(20)}${'SAFETY'.padEnd(10)}${'PROJECT'.padEnd(10)}HINT`
  )

  const rows = entries.map(e => {
    const port = String(e.port).padEnd(7)
    const pid = String(e.pid).padEnd(8)
    const type = e.protocol.toUpperCase().padEnd(6)
    const rawName = e.processName ?? '—'
    const name = (rawName.length > 18 ? rawName.slice(0, 17) + '…' : rawName).padEnd(20)
    const safety = colorSafety(e.safety).padEnd(18) // extra for ANSI codes
    const project = (e.projectType === 'unknown' ? '—' : e.projectType).padEnd(10)
    const hint = getHint(e)

    return `  ${port}${pid}${type}${name}${safety}${project}${hint}`
  })

  return `\n${header}\n${rows.join('\n')}\n`
}

/**
 * Render kill outcomes.
 */
export function formatKillResults(outcomes: KillOutcome[]): string {
  if (outcomes.length === 0) {
    return chalk.dim('  Nothing to report.')
  }

  const lines = outcomes.map(o => {
    const icon = getStatusIcon(o.status)
    const port = String(o.port).padEnd(7)
    return `  ${icon}  ${port}${o.message}`
  })

  return `\n${lines.join('\n')}\n`
}

/**
 * Render dry-run results.
 */
export function formatDryRunResults(outcomes: KillOutcome[]): string {
  const lines = outcomes.map(o => {
    const port = String(o.port).padEnd(7)
    return `  ${chalk.blue('~')}  ${port}${o.message}`
  })

  const wouldKill = outcomes.filter(o => o.status === 'killed').length
  const blocked = outcomes.filter(o => o.status === 'blocked').length
  const warned = outcomes.filter(o => o.status === 'warned').length

  lines.push('')
  lines.push(
    chalk.dim(
      `  Dry run complete. ${wouldKill} would be killed, ${blocked} blocked, ${warned} warned.`
    )
  )

  return `\n${lines.join('\n')}\n`
}

/**
 * Render inspect details.
 */
export function formatInspectResults(entries: PortProcessInfo[]): string {
  if (entries.length === 0) {
    return chalk.dim('  Nothing listening on this port.')
  }

  const sections = entries.map(e => {
    const lines = [
      `  ${chalk.bold('Port:')}        ${e.port}`,
      `  ${chalk.bold('PID:')}         ${e.pid}`,
      `  ${chalk.bold('Name:')}        ${e.processName ?? chalk.dim('unknown')}`,
      `  ${chalk.bold('Command:')}     ${e.command ?? chalk.dim('unknown')}`,
      `  ${chalk.bold('Path:')}        ${e.executablePath ?? chalk.dim('unknown')}`,
      `  ${chalk.bold('Owner:')}       ${e.owner ?? chalk.dim('unknown')}`,
      `  ${chalk.bold('Protocol:')}    ${e.protocol.toUpperCase()}`,
      `  ${chalk.bold('Project:')}     ${e.projectType}`,
      `  ${chalk.bold('Safety:')}      ${colorSafety(e.safety)}`,
    ]

    if (e.reasons.length > 0) {
      lines.push(`  ${chalk.bold('Reasons:')}     ${e.reasons.join(', ')}`)
    }

    return lines.join('\n')
  })

  return `\n${sections.join('\n\n')}\n`
}

// ── Helpers ──────────────────────────────────────────────────

function colorSafety(safety: string): string {
  switch (safety) {
    case 'safe':
      return chalk.green('SAFE')
    case 'warn':
      return chalk.yellow('WARN')
    case 'blocked':
      return chalk.red('BLOCKED')
    default:
      return safety
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'killed':
      return chalk.green('✔')
    case 'already-exited':
      return chalk.green('✔')
    case 'blocked':
      return chalk.red('✖')
    case 'warned':
      return chalk.yellow('⚠')
    case 'failed':
      return chalk.red('✖')
    case 'not-found':
      return chalk.dim('—')
    default:
      return ' '
  }
}

function getHint(entry: PortProcessInfo): string {
  if (entry.safety === 'blocked') {
    if (entry.pid === 1) return 'Protected system process'
    if (entry.pid === 4) return 'run: net stop http'
    return entry.reasons[0] ?? ''
  }

  if (entry.safety === 'warn') {
    if (entry.riskReasons.includes('privileged_port')) return `Try: sudo killit kill ${entry.port}`
    return entry.reasons[0] ?? ''
  }

  // For safe entries, try to show working directory or command hint
  if (entry.command) {
    // Shorten home directory paths
    const home = process.env['HOME'] || process.env['USERPROFILE'] || ''
    if (home && entry.command.includes(home)) {
      return entry.command.replace(home, '~').slice(0, 40)
    }
    return entry.command.slice(0, 40)
  }

  return ''
}
