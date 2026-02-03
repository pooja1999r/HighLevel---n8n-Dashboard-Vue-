import { triggerNode, supportedNodeList, nodeActionType } from '../components/constants'

export interface NodeTemplate {
  name: string
  actionType?: string
  type?: string
  configuration?: ConfigField[]
}

export interface ConfigField {
  type: string
  label: string
  labelType?: string
  default?: unknown
  required?: boolean
  description?: string
  options?: Array<{ label: string; value: string }>
}

export interface NodeConfig {
  label: string
  isTrigger: boolean
  actionType: string
  userInput: Record<string, unknown>
  executableCode: string
  position: { x: number; y: number }
}

/**
 * Find a template by name from triggerNode or supportedNodeList
 */
export function findTemplateByName(name: string): NodeTemplate | undefined {
  return (
    triggerNode.find((n) => n.name === name) ??
    supportedNodeList.find((n) => n.name === name)
  ) as NodeTemplate | undefined
}

/**
 * Get the key for a config field (labelType if available, otherwise label)
 */
export function getFieldKey(field: ConfigField): string {
  return field.labelType ?? field.label
}

/**
 * Get default value from a config field
 * Handles object defaults with { value: ... } structure
 */
export function getDefaultValue(field: ConfigField): unknown {
  const d = field.default
  if (d != null) {
    if (typeof d === 'object' && 'value' in (d as object)) {
      return (d as { value: unknown }).value
    }
    return d
  }
  return field.type === 'number' ? 0 : ''
}

/**
 * Build userInput object with values from configuration fields
 * Uses default values if no values provided
 * Excludes BODY field when METHOD is GET for API calls
 */
export function buildUserInput(
  configuration: ConfigField[],
  values?: Record<string, unknown>,
  actionType?: string
): Record<string, unknown> {
  const userInput: Record<string, unknown> = {}
  
  // First, determine the method value (for API calls)
  let methodValue: string | undefined
  if (actionType === nodeActionType.API_CALL) {
    const methodField = configuration.find(f => getFieldKey(f) === 'METHOD')
    if (methodField) {
      methodValue = values?.['METHOD'] !== undefined 
        ? String(values['METHOD']) 
        : String(getDefaultValue(methodField))
    }
  }
  
  for (const field of configuration) {
    const key = getFieldKey(field)
    
    // Skip BODY field when method is GET
    if (key === 'BODY' && methodValue === 'GET') {
      continue
    }
    
    if (values && values[key] !== undefined) {
      userInput[key] = values[key]
    } else {
      userInput[key] = getDefaultValue(field)
    }
  }
  return userInput
}

/**
 * Generate executable code based on actionType and userInput
 */
export function generateExecutableCode(
  actionType: string,
  userInput: Record<string, unknown>
): string {
  if (actionType === nodeActionType.RUN_CODE) {
    return String(userInput['JAVASCRIPT_CODE'] ?? '')
  }
  
  if (actionType === nodeActionType.API_CALL) {
    const url = String(userInput['URL'] ?? '')
    const method = String(userInput['METHOD'] ?? 'GET')
    const headersRaw = String(userInput['HEADERS'] ?? '')
    let headersObj: Record<string, string> = {}
    try {
      headersObj = headersRaw ? JSON.parse(headersRaw) : {}
    } catch {
      headersObj = {}
    }
    const headersJson = JSON.stringify(headersObj)
    
    // GET requests should not have a body
    if (method === 'GET') {
      return `fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, headers: ${headersJson} })`
    }
    
    const bodyRaw = String(userInput['BODY'] ?? '')
    const bodyExpr = bodyRaw ? JSON.stringify(bodyRaw) : 'undefined'
    return `fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, headers: ${headersJson}, body: ${bodyExpr} })`
  }
  
  if (actionType === nodeActionType.COMPUTATION) {
    return String(userInput['EXPRESSION_CODE'] ?? '')
  }
  
  return ''
}

/**
 * Build complete node config with all required fields
 */
export function buildNodeConfig(
  name: string,
  position: { x: number; y: number },
  values?: Record<string, unknown>
): NodeConfig {
  const template = findTemplateByName(name)
  const actionType = (template?.actionType ?? template?.type ?? '') as string
  const isTrigger = triggerNode.some((n) => n.name === name)
  const configuration = template?.configuration ?? []
  
  const userInput = buildUserInput(configuration, values, actionType)
  const executableCode = generateExecutableCode(actionType, userInput)
  
  return {
    label: name,
    isTrigger,
    actionType,
    userInput,
    executableCode,
    position,
  }
}

/**
 * Check if a node name is a trigger node
 */
export function isTriggerNode(name: string): boolean {
  return triggerNode.some((n) => n.name === name)
}

/**
 * Get configuration fields for a template by name
 */
export function getConfigurationFields(name: string): ConfigField[] {
  const template = findTemplateByName(name)
  return template?.configuration ?? []
}

/**
 * Node execution result interface
 */
export interface NodeExecutionResult {
  output: Record<string, unknown>
  status: 'success' | 'error'
}

/**
 * Execute a single node and return the result
 */
export async function executeNode(
  nodeData: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const userInput = (nodeData.userInput as Record<string, unknown>) ?? {}
  const actionType = (nodeData.actionType as string | undefined) ?? ''
  
  try {
    if (actionType === nodeActionType.RUN_CODE) {
      const code = String(nodeData[nodeActionType.RUN_CODE] ?? userInput['JAVASCRIPT_CODE'] ?? '')
      
      // Capture console output like browser console does
      const logs: Array<{ type: string; args: unknown[] }> = []
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug,
      }
      
      // Override console methods to capture output
      console.log = (...args: unknown[]) => { logs.push({ type: 'log', args }); originalConsole.log(...args) }
      console.warn = (...args: unknown[]) => { logs.push({ type: 'warn', args }); originalConsole.warn(...args) }
      console.error = (...args: unknown[]) => { logs.push({ type: 'error', args }); originalConsole.error(...args) }
      console.info = (...args: unknown[]) => { logs.push({ type: 'info', args }); originalConsole.info(...args) }
      console.debug = (...args: unknown[]) => { logs.push({ type: 'debug', args }); originalConsole.debug(...args) }
      
      let result: unknown
      try {
        // Use Function constructor to execute code and capture return value
        const fn = new Function(code)
        result = fn()
      } finally {
        // Restore original console methods
        console.log = originalConsole.log
        console.warn = originalConsole.warn
        console.error = originalConsole.error
        console.info = originalConsole.info
        console.debug = originalConsole.debug
      }
      
      // Format output similar to browser console
      const consoleOutput = logs.map(log => 
        log.args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')
      )
      
      return { 
        output: { 
          returnedValue: result,
          consoleOutput: consoleOutput.length > 0 ? consoleOutput : undefined,
        }, 
        status: 'success' 
      }
    }
    
    if (actionType === nodeActionType.API_CALL) {
      let code = String(nodeData[nodeActionType.API_CALL] ?? '')
      if (!code) {
        const url = String(userInput['URL'] ?? '')
        const method = String(userInput['METHOD'] ?? 'GET')
        const headersRaw = String(userInput['HEADERS'] ?? '')
        const bodyRaw = String(userInput['BODY'] ?? '')
        let headersObj: Record<string, string> = {}
        try {
          headersObj = headersRaw ? JSON.parse(headersRaw) : {}
        } catch {
          headersObj = {}
        }
        const headersJson = JSON.stringify(headersObj)
        const bodyExpr = bodyRaw ? JSON.stringify(bodyRaw) : 'undefined'
        code = `fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, headers: ${headersJson}, body: ${bodyExpr} })`
      }
      const fn = new Function('fetch', `return (${code})`)
      const response = await fn(fetch)
      let output: unknown = response
      try {
        if (response && typeof response.json === 'function') {
          output = await response.json()
        }
      } catch {
        output = response
      }
      return { output: { response: output }, status: 'success' }
    }
    
    if (actionType === nodeActionType.COMPUTATION) {
      const expr = String(nodeData[nodeActionType.COMPUTATION] ?? userInput['EXPRESSION_CODE'] ?? '')
      const fn = new Function(`return (${expr})`)
      const result = fn()
      return { output: { result }, status: 'success' }
    }
    
    if (actionType === nodeActionType.MANUAL_TRIGGER || actionType === nodeActionType.SCHEDULE_TRIGGER) {
      return { output: { trigger: actionType }, status: 'success' }
    }
    
    return { output: { result: 'No executable action' }, status: 'success' }
  } catch (error) {
    return { output: { error: String(error) }, status: 'error' }
  }
}

/**
 * Format time for execution log header (e.g. "2:45:30 PM")
 */
export function formatExecutedTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Get interval ms from Schedule Trigger config
 */
export function getScheduleIntervalMs(triggerOn: string, between: number): number {
  const units: Record<string, number> = {
    sec: 1000,
    min: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  }
  const unitMs = units[triggerOn] ?? 60 * 1000
  return Math.max(1, between) * unitMs
}

/**
 * Parse Time "HH:mm" and return ms until that time today (or 0 if passed)
 */
export function msUntilTime(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number)
  const now = new Date()
  const target = new Date(now)
  target.setHours(h ?? 0, m ?? 0, 0, 0)
  let ms = target.getTime() - now.getTime()
  if (ms < 0) ms += 24 * 60 * 60 * 1000
  return ms
}
