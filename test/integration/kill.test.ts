import { createTestServer } from '../fixtures/server.js'

describe('kill integration', () => {
  test('kills a test server process', async () => {
    const { inspectPort } = await import('../../src/core/inspect.js')
    const { killResolvedTarget } = await import('../../src/core/kill.js')
    const server = await createTestServer()

    try {
      const targets = await inspectPort(server.port)
      expect(targets.length).toBeGreaterThan(0)

      const result = await killResolvedTarget(targets[0], { force: true })
      expect(['killed', 'already-exited']).toContain(result.status)
    } finally {
      await server.close()
    }
  }, 20000)

  test('escalates to SIGKILL on stubborn processes that ignore SIGTERM when force is true', async () => {
    const { inspectPort } = await import('../../src/core/inspect.js')
    const { killResolvedTarget } = await import('../../src/core/kill.js')

    // Spawn stubborn server
    const server = await createTestServer(true)

    try {
      const targets = await inspectPort(server.port)
      expect(targets.length).toBeGreaterThan(0)

      // Kill with force: true (escalates to SIGKILL)
      const result = await killResolvedTarget(targets[0], { force: true, graceMs: 500 })
      expect(result.status).toBe('killed')
      expect(result.signalSent).toBe('SIGKILL')
    } finally {
      await server.close()
    }
  }, 20000)

  test('returns not-found for unused port', async () => {
    const { inspectPort } = await import('../../src/core/inspect.js')
    const targets = await inspectPort(59999)
    expect(targets).toHaveLength(0)
  }, 10000)
})
