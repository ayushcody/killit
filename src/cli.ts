/**
 * Commander CLI entry point.
 * Commands: list, inspect, kill
 * Exit codes: 0=success, 2=safety refused, 3=EPERM, 4=internal error
 */
import { Command } from 'commander'
import chalk from 'chalk'
import readline from 'readline'
import { listPorts } from './core/list.js'
import { inspectPort } from './core/inspect.js'
import { killResolvedTarget } from './core/kill.js'
import { parsePort } from './validators.js'
import {
  formatListTable,
  formatKillResults,
  formatDryRunResults,
  formatInspectResults,
} from './utils/format.js'
import type { KillOutcome, PortProcessInfo, KillOptions } from './types.js'

const program = new Command()

program
  .name('killit')
  .description('Smart, safe cross-platform port killer for developers')
  .version('1.0.0')

// ── killit list ──────────────────────────────────────────────
program
  .command('list')
  .description('List all listening ports with process info and safety classification')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'No output, just exit code')
  .option('--no-color', 'Plain text output')
  .action(async opts => {
    try {
      const entries = await listPorts()

      if (opts.quiet) {
        process.exit(0)
      }

      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2))
        return
      }

      console.log(formatListTable(entries))
    } catch (err) {
      handleError(err)
    }
  })

// ── killit inspect <port> ────────────────────────────────────
program
  .command('inspect <port>')
  .description('Show detailed info for a specific port')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'No output, just exit code')
  .option('--no-color', 'Plain text output')
  .action(async (portStr: string, opts) => {
    try {
      const port = parsePort(portStr)
      const entries = await inspectPort(port)

      if (opts.quiet) {
        process.exit(entries.length > 0 ? 0 : 0)
      }

      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2))
        return
      }

      console.log(formatInspectResults(entries))
    } catch (err) {
      handleError(err)
    }
  })

// ── killit kill <ports...> ───────────────────────────────────
program
  .command('kill [ports...]')
  .description('Kill processes on specified ports')
  .option('--force', 'Bypass warn safety, escalate to SIGKILL')
  .option('--tree', 'Kill process group (parent + children)')
  .option('--dry-run', 'Preview what would happen, no kills')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'No output, just exit code')
  .option('--no-color', 'Plain text output')
  .option('--grace <ms>', 'SIGTERM wait before escalation (ms)', '1200')
  .option('--all-safe', 'Kill all ports classified as SAFE')
  .option('--strict', 'Exit 1 if nothing was listening')
  .action(async (portArgs: string[], opts) => {
    try {
      const killOpts: KillOptions = {
        force: opts.force ?? false,
        tree: opts.tree ?? false,
        dryRun: opts.dryRun ?? false,
        graceMs: parseInt(opts.grace, 10) || 1200,
      }

      let targets: PortProcessInfo[] = []

      if (opts.allSafe) {
        // Kill all safe-classified ports
        const allPorts = await listPorts()
        targets = allPorts.filter(p => p.safety === 'safe')
      } else {
        if (!portArgs || portArgs.length === 0) {
          console.error(chalk.red('  Error: Specify at least one port, or use --all-safe'))
          process.exit(4)
        }

        const ports = portArgs.map(p => parsePort(p))

        for (const port of ports) {
          const entries = await inspectPort(port)
          if (entries.length === 0) {
            // Nothing listening — idempotent, not an error
          }
          targets.push(...entries)
        }
      }

      if (targets.length === 0) {
        if (opts.strict) {
          if (!opts.quiet) console.log(chalk.dim('  Nothing listening on specified port(s).'))
          process.exit(1)
        }
        if (!opts.quiet) console.log(chalk.dim('  Nothing listening on specified port(s).'))
        process.exit(0)
      }

      // Execute kills
      const outcomes: KillOutcome[] = []
      for (const target of targets) {
        const outcome = await killResolvedTarget(target, killOpts)
        outcomes.push(outcome)
      }

      // Output
      if (opts.quiet) {
        process.exit(determineExitCode(outcomes))
      }

      if (opts.json) {
        console.log(JSON.stringify(outcomes, null, 2))
        process.exit(determineExitCode(outcomes))
      }

      if (killOpts.dryRun) {
        console.log(formatDryRunResults(outcomes))
      } else {
        console.log(formatKillResults(outcomes))
      }

      process.exit(determineExitCode(outcomes))
    } catch (err) {
      handleError(err)
    }
  })

// ── Helpers ──────────────────────────────────────────────────

function determineExitCode(outcomes: KillOutcome[]): number {
  // Check for permission denied
  if (outcomes.some(o => o.status === 'failed' && o.message.includes('Permission denied'))) {
    return 3
  }
  // Check for safety refusals
  if (outcomes.some(o => o.status === 'blocked' || o.status === 'warned')) {
    return 2
  }
  // Check for failures
  if (outcomes.some(o => o.status === 'failed')) {
    return 4
  }
  return 0
}

function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err)
  console.error(chalk.red(`  Error: ${message}`))
  process.exit(4)
}

// ── Interactive & Shorthand Routing ──────────────────────────

async function runInteractiveMenu() {
  console.log(chalk.bold.cyan('\n  🚀 killit — Interactive Port Process Selector\n'))

  let entries: PortProcessInfo[] = []
  try {
    entries = await listPorts()
  } catch (err) {
    handleError(err)
  }

  if (entries.length === 0) {
    console.log(chalk.green('  ✨ No active listening ports found. Everything is clean!\n'))
    process.exit(0)
  }

  console.log(chalk.dim('  Active Listening Processes:'))
  entries.forEach((entry, idx) => {
    const num = chalk.bold.green(`[${idx + 1}]`)
    const portStr = chalk.yellow(`Port ${entry.port}`)
    const nameStr = entry.processName ? chalk.white(entry.processName) : chalk.dim('unknown')
    const pidStr = chalk.dim(`(PID ${entry.pid})`)
    const ownerStr = entry.owner ? chalk.dim(` owner: ${entry.owner}`) : ''

    const safetyStr =
      entry.safety === 'safe'
        ? chalk.bgGreen.black(' SAFE ')
        : entry.safety === 'warn'
          ? chalk.bgYellow.black(' WARN ')
          : chalk.bgRed.black(' BLOCKED ')

    console.log(`  ${num} ${portStr} ➜ ${nameStr} ${pidStr}${ownerStr} [${safetyStr}]`)
  })

  console.log('\n  ' + chalk.dim('─'.repeat(50)))

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ask = () => {
    rl.question(
      chalk.bold.white('\n  Select a process number to kill (or "q" to quit): '),
      async answer => {
        const trimmed = answer.trim().toLowerCase()
        if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
          rl.close()
          console.log(chalk.dim('  Goodbye!\n'))
          process.exit(0)
        }

        const choice = parseInt(trimmed, 10)
        if (isNaN(choice) || choice < 1 || choice > entries.length) {
          console.log(chalk.red('  Invalid choice. Please enter a number listed above.'))
          ask()
          return
        }

        const selected = entries[choice - 1]
        rl.close()

        console.log(
          chalk.cyan(`\n  Resolving termination for Port ${selected.port} (PID ${selected.pid})...`)
        )

        // If safety level is blocked, explain why and abort
        if (selected.safety === 'blocked') {
          console.log(chalk.bgRed.black('\n  ❌ BLOCKED  ') + ` ${selected.reasons.join('; ')}`)
          console.log(
            chalk.red(
              '  Terminating this process is strictly prohibited to maintain system stability.\n'
            )
          )
          process.exit(2)
        }

        // If safety level is warn, ask for confirmation
        if (selected.safety === 'warn') {
          console.log(chalk.bgYellow.black('\n  ⚠️ WARNING  ') + ` ${selected.reasons.join('; ')}`)
          const rlConfirm = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })
          rlConfirm.question(
            chalk.bold.yellow('  Are you sure you want to force kill this process? (y/N): '),
            async confirmAns => {
              rlConfirm.close()
              const confTrimmed = confirmAns.trim().toLowerCase()
              if (confTrimmed === 'y' || confTrimmed === 'yes') {
                await executeKill(selected, { force: true, tree: true })
              } else {
                console.log(chalk.dim('  Aborted.\n'))
                process.exit(0)
              }
            }
          )
          return
        }

        // Otherwise, run safe kill
        await executeKill(selected, { force: false, tree: true })
      }
    )
  }

  ask()
}

async function executeKill(target: PortProcessInfo, opts: KillOptions) {
  try {
    const outcome = await killResolvedTarget(target, opts)
    console.log('\n' + formatKillResults([outcome]) + '\n')
    process.exit(determineExitCode([outcome]))
  } catch (err) {
    handleError(err)
  }
}

// Route based on CLI arguments
const firstArg = process.argv[2]

if (!firstArg || firstArg === '-i' || firstArg === '--interactive') {
  await runInteractiveMenu()
} else if (/^\d+$/.test(firstArg)) {
  // User ran "killit 3000 ..." -> automatically redirect to "killit kill 3000 ..."
  process.argv.splice(2, 0, 'kill')
  program.parse()
} else {
  program.parse()
}
