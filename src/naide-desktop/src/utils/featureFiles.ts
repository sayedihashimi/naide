import { invoke } from '@tauri-apps/api/core';

export interface FeatureFileNode {
  name: string;          // Display name (without date prefix)
  full_name: string;     // Full filename
  path: string;          // Relative path from .prompts/features/
  date: string | null;   // Parsed date (YYYY-MM-DD)
  is_folder: boolean;
  children: FeatureFileNode[] | null;
}

export interface ViewOptions {
  show_bugs: boolean;
  show_removed: boolean;
  show_raw: boolean;
}

/**
 * List all feature files from .prompts/features/
 */
export async function listFeatureFiles(projectPath: string, options?: ViewOptions): Promise<FeatureFileNode[]> {
  try {
    const files = await invoke<FeatureFileNode[]>('list_feature_files', { 
      projectPath,
      options: options || null
    });
    return files;
  } catch (error) {
    console.error('[FeatureFiles] Error listing feature files:', error);
    throw error;
  }
}

/**
 * Read the content of a feature file
 */
export async function readFeatureFile(projectPath: string, filePath: string): Promise<string> {
  try {
    const content = await invoke<string>('read_feature_file', { 
      projectPath, 
      filePath 
    });
    return content;
  } catch (error) {
    console.error('[FeatureFiles] Error reading feature file:', error);
    throw error;
  }
}

/**
 * Write content to a feature file
 */
export async function writeFeatureFile(projectPath: string, filePath: string, content: string): Promise<void> {
  try {
    await invoke<void>('write_feature_file', {
      projectPath,
      filePath,
      content
    });
  } catch (error) {
    console.error('[FeatureFiles] Error writing feature file:', error);
    throw error;
  }
}

/**
 * Filter feature files based on search query
 */
export function filterFeatureFiles(
  nodes: FeatureFileNode[],
  query: string
): FeatureFileNode[] {
  if (!query.trim()) {
    return nodes;
  }
  
  const lowerQuery = query.toLowerCase();
  
  return nodes
    .map(node => {
      if (node.is_folder && node.children) {
        // Recursively filter children
        const filteredChildren = filterFeatureFiles(node.children, query);
        
        // Include folder if it matches or has matching children
        if (node.name.toLowerCase().includes(lowerQuery) || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          };
        }
        return null;
      } else {
        // Include file if name matches
        if (node.name.toLowerCase().includes(lowerQuery)) {
          return node;
        }
        return null;
      }
    })
    .filter((node): node is FeatureFileNode => node !== null);
}
