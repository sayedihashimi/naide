import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let logFilePath: string | null = null;

/**
 * Initialize the file logger
 * Creates log directory and file with timestamp
 */
export function initializeLogger(): void {
  try {
    // Get log directory: %temp%/com.naide.desktop/logs
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
    const initMessage = `[${new Date().toISOString()}] [Sidecar] Log initialized: ${logFilePath}\n`;
    writeFileSync(logFilePath, initMessage, 'utf-8');
    
    console.log(`[Sidecar] File logging initialized: ${logFilePath}`);
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
  originalLog(...args);
  writeToFile('INFO', ...args);
};

console.error = (...args: any[]) => {
  originalError(...args);
  writeToFile('ERROR', ...args);
};

console.warn = (...args: any[]) => {
  originalWarn(...args);
  writeToFile('WARN', ...args);
};
