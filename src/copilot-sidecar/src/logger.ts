import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let logFilePath: string | null = null;

/**
 * Initialize the file logger
 * Reuses log file from Tauri if NAIDE_LOG_FILE env var is set,
 * otherwise creates a new log file with timestamp
 */
export function initializeLogger(): void {
  try {
    // Check if Tauri passed us a log file path via environment variable
    const tauriLogFile = process.env.NAIDE_LOG_FILE;
    
    if (tauriLogFile) {
      // Reuse the log file created by Tauri
      logFilePath = tauriLogFile;
      
      // Append initial log entry
      const initMessage = `[${new Date().toISOString()}] [Sidecar] Log initialized (shared with Tauri): ${logFilePath}\n`;
      appendFileSync(logFilePath, initMessage, 'utf-8');
      
      console.log(`[Sidecar] File logging initialized (shared): ${logFilePath}`);
    } else {
      // Fallback: Create our own log file (for standalone sidecar runs)
      const tempDir = tmpdir();
      const logDir = join(tempDir, 'com.naide.desktop', 'logs');
      
      // Create log directory if it doesn't exist
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      
      // Generate timestamped log filename: naide-2026-02-01T03-30-28.log
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const logFilename = `naide-${timestamp}.log`;
      logFilePath = join(logDir, logFilename);
      
      // Write initial log entry
      const initMessage = `[${new Date().toISOString()}] [Sidecar] Log initialized (standalone): ${logFilePath}\n`;
      writeFileSync(logFilePath, initMessage, 'utf-8');
      
      console.log(`[Sidecar] File logging initialized (standalone): ${logFilePath}`);
    }
  } catch (error) {
    console.error('[Sidecar] Failed to initialize file logger:', error);
    logFilePath = null;
  }
}

/**
 * Write a log message to the file
 */
function writeToFile(level: string, ...args: any[]): void {
  if (!logFilePath) {
    return;
  }
  
  try {
    const timestamp = new Date().toISOString();
    const message = args
      .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
      .join(' ');
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    appendFileSync(logFilePath, logEntry, 'utf-8');
  } catch (error) {
    // Silently fail to avoid infinite loop
    console.error('[Sidecar] Failed to write to log file:', error);
  }
}

// Override console methods to also write to file
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  try {
    originalLog(...args);
  } catch (error) {
    // If console.log fails, try to report to stderr to avoid infinite loop
    try {
      originalError('[Logger] Console.log failed:', error);
    } catch {
      // Last resort: silently fail
    }
  }
  writeToFile('INFO', ...args);
};

console.error = (...args: any[]) => {
  try {
    originalError(...args);
  } catch (error) {
    // If console.error fails, silently continue to avoid infinite loop
  }
  writeToFile('ERROR', ...args);
};

console.warn = (...args: any[]) => {
  try {
    originalWarn(...args);
  } catch (error) {
    // If console.warn fails, try to report to stderr to avoid infinite loop
    try {
      originalError('[Logger] Console.warn failed:', error);
    } catch {
      // Last resort: silently fail
    }
  }
  writeToFile('WARN', ...args);
};
