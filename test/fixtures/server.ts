import { spawn } from 'node:child_process'

export interface TestServerInstance {
  port: number
  pid: number
  close: () => Promise<void>
}

/**
 * Spawns an isolated, detached Node.js TCP server listening on an ephemeral port.
 */
export function createTestServer(stubborn = false): Promise<TestServerInstance> {
  return new Promise((resolve, reject) => {
    const code = stubborn
      ? `
        const net = require('net');
        process.on('SIGTERM', () => {
          console.log('STUBBORN_SIGTERM_IGNORED');
        });
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
          console.log('PORT:' + server.address().port);
        });
        // Keep alive
        setInterval(() => {}, 1000);
      `
      : `
        const net = require('net');
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
          console.log('PORT:' + server.address().port);
        });
        // Keep alive
        setInterval(() => {}, 1000);
      `

    const child = spawn('node', ['-e', code], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Unref child so the event loop doesn't wait for it
    child.unref()

    let stdout = ''
    let resolved = false

    // Timeout fallback
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        child.stdout?.destroy()
        child.stderr?.destroy()
        child.kill('SIGKILL')
        reject(new Error('Spawned test server timed out waiting for port allocation'))
      }
    }, 8000)

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString()
      const match = stdout.match(/PORT:(\d+)/)
      if (match && !resolved) {
        resolved = true
        clearTimeout(timer)
        child.stdout?.destroy()
        child.stderr?.destroy()
        const port = parseInt(match[1], 10)
        resolve({
          port,
          pid: child.pid!,
          close: () => {
            return new Promise<void>(res => {
              if (child.killed) {
                res()
              } else {
                child.on('close', () => res())
                child.on('error', () => res())

                // Kill process group cleanly
                try {
                  process.kill(-child.pid!, 'SIGKILL')
                } catch {
                  try {
                    child.kill('SIGKILL')
                  } catch {
                    // already dead
                  }
                }
                res()
              }
            })
          },
        })
      }
    })

    child.on('error', err => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        child.stdout?.destroy()
        child.stderr?.destroy()
        reject(err)
      }
    })
  })
}
