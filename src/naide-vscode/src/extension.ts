/**
 * Naide VS Code Extension
 * 
 * A spec-driven AI development assistant that registers as a Copilot Chat participant.
 * Provides @naide chat participant with /plan, /build, and /analyze commands.
 */

import * as vscode from 'vscode';
import { registerNaideParticipant } from './participant';
import { registerLearningsTool } from './learnings';

/**
 * Extension activation function
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[Naide] Activating extension...');

  try {
    // Register the @naide chat participant
    registerNaideParticipant(context);

    // Register the search_learnings language model tool
    registerLearningsTool(context);

    console.log('[Naide] Extension activated successfully');
  } catch (error) {
    console.error('[Naide] Error activating extension:', error);
    vscode.window.showErrorMessage(`Failed to activate Naide extension: ${error}`);
  }
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  console.log('[Naide] Deactivating extension...');
}
