/**
 * Logger utility that forwards console logs to Tauri backend log file
 * This ensures that frontend logs appear in the Tauri log file for debugging
 * Uses Tauri commands to reliably write logs to the backend
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Helper to safely invoke Tauri command (handles test environment where Tauri is not available)
 */
function safeInvoke(level: string, message: string): void {
  try {
    if (typeof invoke !== 'undefined') {
      invoke('log_to_file', { level, message }).catch((err: Error) => 
        console.error('Failed to write to Tauri log:', err)
      );
    }
  } catch {
    // Silently fail in test environment where Tauri is not available
  }
}

/**
 * Log an info message (forwards to Tauri log file)
 */
export function logInfo(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.log(message, ...args); // Also log to console for DevTools
  safeInvoke('info', fullMessage);
}

/**
 * Log an error message (forwards to Tauri log file)
 */
export function logError(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.error(message, ...args); // Also log to console for DevTools
  safeInvoke('error', fullMessage);
}

/**
 * Log a warning message (forwards to Tauri log file)
 */
export function logWarn(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.warn(message, ...args); // Also log to console for DevTools
  safeInvoke('warn', fullMessage);
}

/**
 * Log a debug message (forwards to Tauri log file)
 */
export function logDebug(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.log(message, ...args); // Also log to console for DevTools
  safeInvoke('debug', fullMessage);
}
