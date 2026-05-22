export type Platform = 'macos' | 'linux' | 'windows'
export type SafetyLevel = 'safe' | 'warn' | 'blocked'
export type ProjectType = 'node' | 'vite' | 'next' | 'python' | 'docker' | 'ruby' | 'go' | 'unknown'

export type KillStatus =
  | 'killed' // process terminated
  | 'not-found' // nothing on that port
  | 'blocked' // hard safety block (PID 1, System etc.)
  | 'warned' // warn-level, needs --force
  | 'already-exited' // race: process died between inspect + kill
  | 'failed' // EPERM or still alive after SIGTERM

export interface PortProcessInfo {
  port: number
  pid: number
  ppid?: number // for --ancestor support
  protocol: 'tcp' | 'udp'
  processName?: string
  command?: string // full argv[0..n]
  executablePath?: string
  owner?: string
  projectType: ProjectType
  safety: SafetyLevel
  reasons: string[] // human-readable safety notes
  riskReasons: string[] // machine-readable risk codes
}

export interface KillOptions {
  force?: boolean // bypass warn, escalate to SIGKILL
  graceMs?: number // SIGTERM → SIGKILL wait (default 1200)
  tree?: boolean // kill process group (Unix: -pgid)
  dryRun?: boolean // preview only, no kill
  includeBlocked?: boolean // override hard blocks (advanced)
}

export interface KillOutcome {
  port: number
  pid?: number
  status: KillStatus
  message: string
  signalSent?: string
  riskReasons: string[]
}

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface RawPortEntry {
  port: number
  pid: number
  protocol: 'tcp' | 'udp'
  processName?: string
  command?: string
  executablePath?: string
  owner?: string
}
