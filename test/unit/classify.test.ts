import { classifyTarget } from '../../src/core/classify.js'

describe('classifyTarget', () => {
  // ── HARD BLOCKS ────────────────────────────────────────
  test('blocks PID 1 (init/launchd/systemd)', () => {
    const result = classifyTarget({ pid: 1, port: 80, processName: 'init' })
    expect(result.safety).toBe('blocked')
    expect(result.riskReasons).toContain('pid_1')
  })

  test('blocks PID 4 + System (Windows http.sys)', () => {
    const result = classifyTarget({ pid: 4, port: 80, processName: 'System' })
    expect(result.safety).toBe('blocked')
    expect(result.riskReasons).toContain('win_system_pid4')
  })

  test('blocks Linux kernel threads like [kworker/0:0]', () => {
    const result = classifyTarget({ pid: 100, port: 8080, processName: '[kworker/0:0]' })
    expect(result.safety).toBe('blocked')
    expect(result.riskReasons).toContain('kernel_thread')
  })

  // ── WARN TRIGGERS ─────────────────────────────────────
  test('warns on privileged port (<1024)', () => {
    const result = classifyTarget({
      pid: 1234,
      port: 443,
      processName: 'nginx',
      owner: 'www',
      executablePath: '/usr/sbin/nginx',
    })
    expect(result.safety).toBe('warn')
    expect(result.riskReasons).toContain('privileged_port')
  })

  test('warns on system directory binary', () => {
    const result = classifyTarget({
      pid: 1234,
      port: 8080,
      processName: 'httpd',
      executablePath: '/System/Library/httpd',
      owner: 'www',
    })
    expect(result.safety).toBe('warn')
    expect(result.riskReasons).toContain('system_path')
  })

  test('warns on root owner', () => {
    const result = classifyTarget({
      pid: 1234,
      port: 3000,
      processName: 'node',
      owner: 'root',
      executablePath: '/usr/local/bin/node',
    })
    expect(result.safety).toBe('warn')
    expect(result.riskReasons).toContain('system_owner')
  })

  test('warns on docker-proxy', () => {
    const result = classifyTarget({
      pid: 1234,
      port: 3000,
      processName: 'docker-proxy',
      owner: 'root',
      executablePath: '/usr/bin/docker-proxy',
    })
    expect(result.safety).toBe('warn')
    expect(result.riskReasons).toContain('docker_proxy')
  })

  // ── CRITICAL: unknown metadata → warn, NOT safe ───────
  test('warns when all metadata is null (unknown risk)', () => {
    const result = classifyTarget({ pid: 1234, port: 3000 })
    expect(result.safety).toBe('warn')
    expect(result.riskReasons).toContain('unknown_metadata')
  })

  // ── SAFE ──────────────────────────────────────────────
  test('returns safe when no risk indicators', () => {
    const result = classifyTarget({
      pid: 1234,
      port: 3000,
      processName: 'node',
      owner: 'ayush',
      executablePath: '/usr/local/bin/node',
    })
    expect(result.safety).toBe('safe')
    expect(result.riskReasons).toEqual([])
  })
})
