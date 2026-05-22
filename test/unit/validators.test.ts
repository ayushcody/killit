import { parsePort } from '../../src/validators.js'

describe('parsePort', () => {
  test('accepts valid port "3000"', () => {
    expect(parsePort('3000')).toBe(3000)
  })

  test('accepts "1" (minimum)', () => {
    expect(parsePort('1')).toBe(1)
  })

  test('accepts "65535" (maximum)', () => {
    expect(parsePort('65535')).toBe(65535)
  })

  test('rejects "0"', () => {
    expect(() => parsePort('0')).toThrow('out of range')
  })

  test('rejects "-1"', () => {
    expect(() => parsePort('-1')).toThrow('must be a positive integer')
  })

  test('rejects "65536"', () => {
    expect(() => parsePort('65536')).toThrow('out of range')
  })

  test('rejects "abc"', () => {
    expect(() => parsePort('abc')).toThrow('must be a positive integer')
  })

  test('rejects "3000.5"', () => {
    expect(() => parsePort('3000.5')).toThrow('must be a positive integer')
  })

  test('rejects empty string', () => {
    expect(() => parsePort('')).toThrow('must be a positive integer')
  })

  test('accepts port with whitespace padding', () => {
    expect(parsePort('  8080  ')).toBe(8080)
  })
})
