# killit

> Smart, safe cross-platform port killer for developers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install -g killit
```

Or use directly:

```bash
npx killit list
```

## Quick Start

### 1. Interactive Selection Selector (TUI)

Just run `ki` or `killit` alone with no arguments to launch a clean, interactive selector menu listing all active listening ports with their safety status. Type a number and hit `Enter` to safely terminate the process!

```bash
# Launch interactive TUI selector menu
ki
# or
killit
```

### 2. Shorthand Port Killing (Direct Args)

You no longer need to type the word `kill`! Just pass the port(s) directly to the binary:

```bash
# Terminate port 3000 safely
ki 3000

# Terminate multiple ports
ki 3000 8080 5173
```

### 3. Advanced Commands

```bash
# See what's listening with safety analysis
killit list

# Detailed port metadata inspection
killit inspect 3000

# Force terminate process group (escalates to SIGKILL if stubborn)
ki 3000 --force --tree

# Kill all safe-classified ports
ki kill --all-safe
```

## CLI Reference

### Commands

| Command   | Arguments    | Description                                                                                                                           | Applicable Flags                                                                           | Example                 |
| :-------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------- | :---------------------- |
| `list`    | _None_       | Scans and lists all active listening ports with PID, protocol type, process name, safety levels, project type, and filesystem paths.  | `--json`, `--quiet`, `--no-color`                                                          | `killit list`           |
| `inspect` | `<port>`     | Performs deep inspection on a specific port, printing ownership, full process path, project type, and detailed security risk reasons. | `--json`, `--quiet`, `--no-color`                                                          | `killit inspect 3000`   |
| `kill`    | `<ports...>` | Terminates processes listening on the specified ports. Gracefully sends `SIGTERM` first and escalates if force is enabled.            | `--force`, `--tree`, `--dry-run`, `--grace`, `--all-safe`, `--strict`, `--json`, `--quiet` | `killit kill 3000 8080` |

---

### Command Flags

| Flag           | Type    | Default | Applicable Commands       | Description                                                                                                                       |
| :------------- | :------ | :------ | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| `--force`      | Boolean | `false` | `kill`                    | Bypasses `WARN` level classifications (e.g., root process, docker proxy) and escalates stubborn processes to `SIGKILL`.           |
| `--tree`       | Boolean | `false` | `kill`                    | Terminates the entire process tree (the parent process and all child/descendant processes) cleanly.                               |
| `--dry-run`    | Boolean | `false` | `kill`                    | Simulated preview only. Lists which processes _would_ have been killed without actually performing any kills.                     |
| `--json`       | Boolean | `false` | `list`, `inspect`, `kill` | Outputs the command result as a structured JSON array of objects. Ideal for shell scripts, tools, and CI/CD pipelines.            |
| `--quiet`      | Boolean | `false` | `list`, `inspect`, `kill` | Suppresses all console output. Commands run silently and rely entirely on the exit code to report success/failure.                |
| `--no-color`   | Boolean | `false` | `list`, `inspect`, `kill` | Disables colored outputs and ANSI formatters, rendering plain-text table grids.                                                   |
| `--grace <ms>` | Integer | `1200`  | `kill`                    | The duration (in milliseconds) `killit` waits after sending a graceful `SIGTERM` before escalating to `SIGKILL` (with `--force`). |
| `--all-safe`   | Boolean | `false` | `kill`                    | Discovers and terminates all processes holding ports classified as `SAFE` in a single command.                                    |
| `--strict`     | Boolean | `false` | `kill`                    | Causes the command to exit with status code `1` if no processes were actively listening on the target ports.                      |

## API Reference

```typescript
import { listPorts, inspectPort, killPort } from 'killit'

// List all listening ports
const ports = await listPorts()

// Inspect a specific port
const info = await inspectPort(3000) // returns PortProcessInfo[]

// Kill a port process
const result = await killPort(info[0], { force: true, tree: true })
```

## Safety Policy

killit classifies every process into three safety levels:

| Level       | Behavior           | Examples                                             |
| ----------- | ------------------ | ---------------------------------------------------- |
| **SAFE**    | Killed immediately | Your Node/Python/Ruby dev servers                    |
| **WARN**    | Requires `--force` | Root-owned, privileged ports, Docker proxy           |
| **BLOCKED** | Never killed       | PID 1 (init), PID 4 (Windows System), kernel threads |

### Remediation hints

- **PID 1**: Protected system process — cannot be killed
- **PID 4 (Windows)**: `net stop http` to release the port
- **Privileged port**: `sudo killit kill <port>`
- **Permission denied**: `sudo killit kill <port>` or run terminal as Administrator

## Exit Codes

| Code | Meaning                                                 |
| ---- | ------------------------------------------------------- |
| 0    | Success — killed, or nothing was listening (idempotent) |
| 2    | Safety refused — use `--force`                          |
| 3    | Permission denied — needs sudo/admin                    |
| 4    | Internal error / parse failure                          |

## Security

- **No install scripts** — killit has no `preinstall`, `postinstall`, or `install` npm scripts. Your system is never touched at install time.
- **All OS commands use array arguments** passed to `spawn()` — user input is never interpolated into shell strings. This prevents the class of injection vulnerability found in CVE-2019-5414.
- **Port inputs are validated** as integers in the range 1–65535 before any system call.
- **The safety policy is versioned API** — any change that broadens the set of processes killit will kill without `--force` is a major version bump.

## Platform Support

| Platform          | Method                          | Notes                            |
| ----------------- | ------------------------------- | -------------------------------- |
| **macOS**         | `lsof -F pcn`                   | Ships natively, always available |
| **Linux**         | `ss` → `lsof` → `/proc/net/tcp` | Falls back automatically         |
| **Docker/Alpine** | `/proc/net/tcp` direct          | Zero external dependency         |
| **Windows**       | `netstat` + PowerShell          | No `wmic` (deprecated in Win11)  |

## Contributing

1. Fork & clone
2. `npm install`
3. `npm run build`
4. `npm test`
5. Submit PR

## License

MIT
