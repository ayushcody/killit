import { createTestServer } from '../fixtures/server.js'

describe('listPorts integration', () => {
  test('detects a listening test server', async () => {
    const { listPorts } = await import('../../src/core/list.js')
    const server = await createTestServer()

    try {
      const ports = await listPorts()
      const found = ports.find(p => p.port === server.port)

      expect(found).toBeDefined()
      expect(found!.pid).toBeGreaterThan(0)
      expect(found!.safety).toBeDefined()
      expect(found!.protocol).toBe('tcp')
    } finally {
      await server.close()
    }
  }, 15000)
})
