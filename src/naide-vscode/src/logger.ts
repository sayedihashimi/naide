/**
 * Logging utility for Naide VS Code extension
 * Provides a dedicated output channel for diagnostic logs
 */

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

/**
 * Initialize the logger with an output channel
 * @param channel - The VS Code output channel to use
 */
export function initializeLogger(channel: vscode.OutputChannel): void {
  outputChannel = channel;
}

/**
 * Log an info message
 * @param message - The message to log
 */
export function logInfo(message: string): void {
  if (outputChannel) {
    outputChannel.appendLine(message);
  }
  // Also log to console for development
  console.log(message);
}

/**
 * Log an error message
 * @param message - The message to log
 * @param error - Optional error object
 */
export function logError(message: string, error?: unknown): void {
  const errorMsg = error ? `${message}: ${error}` : message;
  if (outputChannel) {
    outputChannel.appendLine(errorMsg);
  }
  // Also log to console for development
  console.error(message, error);
}

/**
 * Log a warning message
 * @param message - The message to log
 */
export function logWarn(message: string): void {
  if (outputChannel) {
    outputChannel.appendLine(message);
  }
  // Also log to console for development
  console.warn(message);
}
