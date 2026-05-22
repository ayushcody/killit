/**
 * Infer project type from command string.
 */
import type { ProjectType } from '../types.js'

export function inferProjectType(command?: string): ProjectType {
  if (!command) return 'unknown'

  const cmd = command.toLowerCase()

  // Order matters — more specific matches first
  if (cmd.includes('vite')) return 'vite'
  if (cmd.includes('next dev') || cmd.includes('next start') || cmd.includes('next-server'))
    return 'next'
  if (
    cmd.includes('uvicorn') ||
    cmd.includes('flask') ||
    cmd.includes('manage.py') ||
    cmd.includes('gunicorn')
  )
    return 'python'
  if (cmd.includes('rails') || cmd.includes('puma') || cmd.includes('unicorn')) return 'ruby'
  if (cmd.includes('go run') || cmd.includes(' air')) return 'go'
  if (cmd.includes('docker-proxy')) return 'docker'
  if (cmd.includes('node') || cmd.includes('ts-node') || cmd.includes('tsx')) return 'node'

  return 'unknown'
}
