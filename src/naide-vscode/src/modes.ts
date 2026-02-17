/**
 * Mode configuration for Naide chat participant
 */

export type NaideMode = 'Planning' | 'Building';

/**
 * Maps a slash command to a Naide mode
 * @param command - The slash command (e.g., 'plan', 'build')
 * @returns The corresponding Naide mode
 */
export function getModeFromCommand(command: string | undefined): NaideMode {
  switch (command) {
    case 'plan':
      return 'Planning';
    case 'build':
      return 'Building';
    default:
      return 'Planning';
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
    case 'Planning':
      return [...baseFiles, 'planning.system.md'];
    case 'Building':
      return [...baseFiles, 'building.system.md'];
    default:
      return baseFiles;
  }
}
