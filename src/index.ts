/**
 * Public API for killit.
 * Provides programmatic access to list, inspect, and kill port processes.
 */

// Re-export types
export type {
  Platform,
  SafetyLevel,
  ProjectType,
  KillStatus,
  PortProcessInfo,
  KillOptions,
  KillOutcome,
} from './types.js'

// Core functions
export { listPorts } from './core/list.js'
export { inspectPort } from './core/inspect.js'
export { killResolvedTarget as killPort } from './core/kill.js'
export { classifyTarget } from './core/classify.js'
export { inferProjectType } from './core/infer.js'
export { parsePort } from './validators.js'
