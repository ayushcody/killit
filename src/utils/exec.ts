/**
 * Safe spawn wrapper — array args enforced.
 * SECURITY: Never use exec() with template literals or shell: true
 * (except Windows netstat which requires shell for pipe handling).
 */
import { spawn } from 'node:child_process'
import type { ExecResult } from '../types.js'

export function run(
  cmd: string,
  args: string[],
  options?: { shell?: boolean; timeout?: number }
): Promise<ExecResult> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, {
      shell: options?.shell ?? false,
      timeout: options?.timeout ?? 10_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', err => {
      resolve({ stdout: '', stderr: err.message, exitCode: null })
    })

    child.on('close', code => {
      resolve({ stdout, stderr, exitCode: code })
    })
  })
}
