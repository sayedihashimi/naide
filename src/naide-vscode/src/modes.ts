/**
 * Mode configuration for Naide chat participant
 */

export type NaideMode = 'Auto' | 'Planning' | 'Building' | 'Analyzing';

/**
 * Maps a slash command to a Naide mode
 * @param command - The slash command (e.g., 'plan', 'build', 'analyze')
 * @returns The corresponding Naide mode
 */
export function getModeFromCommand(command: string | undefined): NaideMode {
  switch (command) {
    case 'plan':
      return 'Planning';
    case 'build':
      return 'Building';
    case 'analyze':
      return 'Analyzing';
    default:
      return 'Auto';
  }
}

/**
 * Gets the system prompt filenames for a given mode
 * @param mode - The Naide mode
 * @returns Array of system prompt filenames to load (in order)
 */
export function getSystemPromptFiles(mode: NaideMode): string[] {
  const baseFiles = ['base.system.md'];
  
  switch (mode) {
    case 'Auto':
      // Auto mode loads auto.system.md plus both planning and building prompts
      return [...baseFiles, 'auto.system.md', 'planning.system.md', 'building.system.md'];
    case 'Planning':
      return [...baseFiles, 'planning.system.md'];
    case 'Building':
      return [...baseFiles, 'building.system.md'];
    case 'Analyzing':
      return [...baseFiles, 'analyzing.system.md'];
    default:
      return baseFiles;
  }
}
