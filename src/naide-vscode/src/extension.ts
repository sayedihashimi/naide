/**
 * Naide VS Code Extension
 * 
 * A spec-driven AI development assistant that registers as a Copilot Chat participant.
 * Provides @naide chat participant with /plan, /build, and /analyze commands.
 */

import * as vscode from 'vscode';
import { registerNaideParticipant } from './participant';
import { registerLearningsTool } from './learnings';
import { initializeLogger, logInfo, logError } from './logger';

/**
 * Extension activation function
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for diagnostic logs
  const outputChannel = vscode.window.createOutputChannel('Naide');
  context.subscriptions.push(outputChannel);
  
  // Initialize logger
  initializeLogger(outputChannel);
  
  logInfo('[Naide] Activating extension...');
  logInfo('[Naide] TIP: View diagnostic logs in Output panel > "Naide" dropdown');

  try {
    // Register the @naide chat participant
    registerNaideParticipant(context);

    // Register the search_learnings language model tool
    registerLearningsTool(context);

    logInfo('[Naide] Extension activated successfully');
  } catch (error) {
    logError('[Naide] Error activating extension', error);
    vscode.window.showErrorMessage(`Failed to activate Naide extension: ${error}`);
  }
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  logInfo('[Naide] Deactivating extension...');
}
