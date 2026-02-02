/**
 * Utilities for managing Tauri file system permissions
 * Grants access to project directories selected by the user
 */

/**
 * Grant file system permissions for a project directory
 * In Tauri 2.x, the dialog plugin automatically grants scope for selected directories
 * This function is a placeholder for any additional permission management needed
 * 
 * @param projectPath - The absolute path to the project directory
 */
export async function grantProjectPermissions(projectPath: string): Promise<void> {
  try {
    console.log(`[Permissions] Project path registered: ${projectPath}`);
    // Note: In Tauri 2.x with fs:default and fs:scope permissions,
    // directories selected via the dialog are automatically added to the allowed scope
  } catch (error) {
    console.error(`[Permissions] Error handling permissions for ${projectPath}:`, error);
  }
}
