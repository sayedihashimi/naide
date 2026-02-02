/**
 * Logger utility that forwards console logs to Tauri backend log file
 * This ensures that frontend logs appear in the Tauri log file for debugging
 */

import { info, error, warn, debug } from '@tauri-apps/plugin-log';

/**
 * Log an info message (forwards to Tauri log file)
 */
export function logInfo(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.log(message, ...args); // Also log to console for DevTools
  info(fullMessage).catch(e => console.error('Failed to write to Tauri log:', e));
}

/**
 * Log an error message (forwards to Tauri log file)
 */
export function logError(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.error(message, ...args); // Also log to console for DevTools
  error(fullMessage).catch(e => console.error('Failed to write to Tauri log:', e));
}

/**
 * Log a warning message (forwards to Tauri log file)
 */
export function logWarn(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.warn(message, ...args); // Also log to console for DevTools
  warn(fullMessage).catch(e => console.error('Failed to write to Tauri log:', e));
}

/**
 * Log a debug message (forwards to Tauri log file)
 */
export function logDebug(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.log(message, ...args); // Also log to console for DevTools
  debug(fullMessage).catch(e => console.error('Failed to write to Tauri log:', e));
}
