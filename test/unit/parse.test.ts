import {
  parseLsofOutput,
  parseSsOutput,
  parseProcNetTcp,
  parseNetstatOutput,
} from '../../src/utils/parse.js'

describe('parseLsofOutput', () => {
  test('parses lsof -F pcn output', () => {
    const output = `p1234\ncnode\nn127.0.0.1:3000\np5678\ncpython3\nn*:8000\n`
    const entries = parseLsofOutput(output)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(
      expect.objectContaining({ port: 3000, pid: 1234, processName: 'node' })
    )
    expect(entries[1]).toEqual(
      expect.objectContaining({ port: 8000, pid: 5678, processName: 'python3' })
    )
  })

  test('deduplicates by port+pid', () => {
    const output = `p1234\ncnode\nn127.0.0.1:3000\nn[::1]:3000\n`
    const entries = parseLsofOutput(output)
    expect(entries).toHaveLength(1)
  })
})

describe('parseSsOutput', () => {
  test('parses ss -tlnp output', () => {
    const output = [
      'State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process',
      'LISTEN  0       128     0.0.0.0:3000        0.0.0.0:*          users:(("node",pid=1234,fd=18))',
      'LISTEN  0       128     [::]:8080            [::]:*             users:(("python3",pid=5678,fd=5))',
    ].join('\n')

    const entries = parseSsOutput(output)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(
      expect.objectContaining({ port: 3000, pid: 1234, processName: 'node' })
    )
    expect(entries[1]).toEqual(
      expect.objectContaining({ port: 8080, pid: 5678, processName: 'python3' })
    )
  })
})

describe('parseProcNetTcp', () => {
  test('parses /proc/net/tcp hex addresses', () => {
    // Port 3000 = 0x0BB8, state 0A = LISTEN
    const content = [
      '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
      '   0: 00000000:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 12345 1 0000000000000000 100 0 0 10 0',
      '   1: 00000000:0050 00000000:0000 01 00000000:00000000 00:00000000 00000000     0        0 67890 1 0000000000000000 100 0 0 10 0',
    ].join('\n')

    const results = parseProcNetTcp(content)
    // Only state 0A (LISTEN) should match
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ port: 3000, inode: '12345' })
  })
})

describe('parseNetstatOutput', () => {
  test('parses netstat -ano IPv4 and IPv6', () => {
    const output = [
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234',
      '  TCP    [::]:3000              [::]:0                 LISTENING       1234',
      '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       5678',
    ].join('\n')

    const entries = parseNetstatOutput(output)
    // Should deduplicate port 3000 + pid 1234
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(expect.objectContaining({ port: 3000, pid: 1234 }))
    expect(entries[1]).toEqual(expect.objectContaining({ port: 8080, pid: 5678 }))
  })
})
