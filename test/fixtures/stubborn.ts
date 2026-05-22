// Spawn as a child process — ignores SIGTERM to test SIGKILL escalation
process.on('SIGTERM', () => {
  /* intentionally ignored */
})

import net from 'node:net'
const server = net.createServer()
server.listen(parseInt(process.argv[2] ?? '0'), '127.0.0.1', () => {
  const addr = server.address() as net.AddressInfo
  process.send?.({ port: addr.port }) // IPC to parent test
})
