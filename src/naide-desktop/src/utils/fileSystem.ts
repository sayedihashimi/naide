import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join, documentDir } from '@tauri-apps/api/path';

export interface ProjectConfig {
  name: string;
  path: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  createdAt: string;
}

export interface NaideConfig {
  lastUsedProject: string | null;
  projects: ProjectInfo[];
}

// Get the config directory path (.naide in Documents)
export async function getConfigPath(): Promise<string> {
  const docsPath = await documentDir();
  return await join(docsPath, '.naide');
}

// Get the config file path
export async function getConfigFilePath(): Promise<string> {
  const configDir = await getConfigPath();
  return await join(configDir, 'config.json');
}

// Load config from .naide/config.json
export async function loadConfig(): Promise<NaideConfig> {
  try {
    const configFilePath = await getConfigFilePath();
    const configExists = await exists(configFilePath);
    
    if (!configExists) {
      console.log('[Config] No config file found, returning default');
      return {
        lastUsedProject: null,
        projects: []
      };
    }
    
    const content = await readTextFile(configFilePath);
    const config = JSON.parse(content);
    console.log('[Config] Loaded config:', config);
    return config;
  } catch (error) {
    console.error('[Config] Error loading config:', error);
    return {
      lastUsedProject: null,
      projects: []
    };
  }
}

// Save config to .naide/config.json
export async function saveConfig(config: NaideConfig): Promise<void> {
  try {
    const configDir = await getConfigPath();
    const configDirExists = await exists(configDir);
    
    if (!configDirExists) {
      console.log('[Config] Creating config directory:', configDir);
      await mkdir(configDir, { recursive: true });
    }
    
    const configFilePath = await getConfigFilePath();
    const content = JSON.stringify(config, null, 2);
    console.log('[Config] Saving config to:', configFilePath);
    await writeTextFile(configFilePath, content);
    console.log('[Config] Config saved successfully');
  } catch (error) {
    console.error('[Config] Error saving config:', error);
    throw error;
  }
}

// Update last used project in config
export async function updateLastUsedProject(projectPath: string): Promise<void> {
  try {
    const config = await loadConfig();
    config.lastUsedProject = projectPath;
    await saveConfig(config);
    console.log('[Config] Updated last used project:', projectPath);
  } catch (error) {
    console.error('[Config] Error updating last used project:', error);
  }
}

// Add a project to the projects list
export async function addProjectToConfig(projectInfo: ProjectInfo): Promise<void> {
  try {
    const config = await loadConfig();
    
    // Check if project already exists
    const existingIndex = config.projects.findIndex(p => p.path === projectInfo.path);
    if (existingIndex >= 0) {
      // Update existing project
      config.projects[existingIndex] = projectInfo;
    } else {
      // Add new project
      config.projects.push(projectInfo);
    }
    
    await saveConfig(config);
    console.log('[Config] Added/updated project in config:', projectInfo.name);
  } catch (error) {
    console.error('[Config] Error adding project to config:', error);
  }
}

// Get the base project directory path
export async function getProjectsBasePath(): Promise<string> {
  const docsPath = await documentDir();
  return await join(docsPath, 'naide', 'projects');
}

// Get specific project path
export async function getProjectPath(projectName: string): Promise<string> {
  const basePath = await getProjectsBasePath();
  return await join(basePath, projectName);
}

// Initialize a new project (create directories)
export async function initializeProject(projectName: string): Promise<void> {
  const projectPath = await getProjectPath(projectName);
  
  try {
    console.log(`[FileSystem] Initializing project at: ${projectPath}`);
    const projectExists = await exists(projectPath);
    console.log(`[FileSystem] Project exists: ${projectExists}`);
    
    if (!projectExists) {
      // Create project directory (recursively)
      const basePath = await getProjectsBasePath();
      console.log(`[FileSystem] Creating base path: ${basePath}`);
      await mkdir(basePath, { recursive: true });
      console.log(`[FileSystem] Creating project path: ${projectPath}`);
      await mkdir(projectPath);
      console.log(`[FileSystem] Project initialized successfully`);
    }
  } catch (error) {
    console.error('[FileSystem] Error initializing project:', error);
    // Don't throw - just log, as this might fail in browser/dev mode
  }
}

// Create all project files (can be empty)
export async function createAllProjectFiles(projectName: string, initialIntent?: string): Promise<void> {
  try {
    console.log(`[FileSystem] Creating all project files for: ${projectName}`);
    
    // Ensure project folder exists
    await initializeProject(projectName);
    
    const projectPath = await getProjectPath(projectName);
    
    // Define all files
    const files = [
      { name: 'Intent.md', content: initialIntent ? `# Overview\n\n## What do you want to build?\n\n${initialIntent}\n\n` : '# Overview\n\n' },
      { name: 'AppSpec.md', content: '# Features\n\n' },
      { name: 'DataSpec.md', content: '# Data\n\n' },
      { name: 'Rules.md', content: '# Access & Rules\n\n' },
      { name: 'Assumptions.md', content: '# Assumptions\n\n' },
      { name: 'Tasks.json', content: '{}' }
    ];
    
    // Create each file
    for (const file of files) {
      const filePath = await join(projectPath, file.name);
      const fileExists = await exists(filePath);
      
      if (!fileExists) {
        console.log(`[FileSystem] Creating ${file.name}`);
        await writeTextFile(filePath, file.content);
      } else {
        console.log(`[FileSystem] ${file.name} already exists, skipping`);
      }
    }
    
    console.log(`[FileSystem] All project files created successfully`);
    
    // Update config
    const projectInfo: ProjectInfo = {
      name: projectName,
      path: projectPath,
      createdAt: new Date().toISOString()
    };
    await addProjectToConfig(projectInfo);
    await updateLastUsedProject(projectPath);
    
  } catch (error) {
    console.error('[FileSystem] Error creating project files:', error);
    throw error;
  }
}

// Save section content to file
export async function saveSectionToFile(
  projectName: string,
  filename: string,
  content: string
): Promise<void> {
  try {
    const projectPath = await getProjectPath(projectName);
    const filePath = await join(projectPath, filename);
    console.log(`[FileSystem] Saving ${filename} to: ${filePath}`);
    console.log(`[FileSystem] Content length: ${content.length} characters`);
    await writeTextFile(filePath, content);
    console.log(`[FileSystem] Successfully saved ${filename}`);
  } catch (error) {
    console.error(`[FileSystem] Error saving ${filename}:`, error);
    throw error;
  }
}

// Read section content from file
export async function readSectionFromFile(
  projectName: string,
  filename: string
): Promise<string> {
  try {
    const projectPath = await getProjectPath(projectName);
    const filePath = await join(projectPath, filename);
    
    const fileExists = await exists(filePath);
    if (!fileExists) {
      return '';
    }
    
    return await readTextFile(filePath);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return '';
  }
}

// Format section content as markdown
export function formatSectionAsMarkdown(
  sectionName: string,
  questions: Array<{ id: string; question: string; type: string }>,
  answers: Record<string, string>
): string {
  let markdown = `# ${sectionName}\n\n`;
  
  questions.forEach((question) => {
    const answer = answers[question.id] || '';
    markdown += `## ${question.question}\n\n`;
    if (answer.trim()) {
      markdown += `${answer}\n\n`;
    } else {
      markdown += `_No answer provided_\n\n`;
    }
  });
  
  return markdown;
}

// Parse markdown file to extract question/answer pairs
export function parseMarkdownFile(content: string): Record<string, string> {
  const answers: Record<string, string> = {};
  
  // Split by ## headings (questions)
  const sections = content.split(/^## /m).slice(1); // Skip the # title
  
  sections.forEach((section) => {
    const lines = section.trim().split('\n');
    const questionLine = lines[0];
    const answerLines = lines.slice(1).join('\n').trim();
    
    // Convert question back to question ID
    // e.g., "What To Build" -> "what-to-build"
    const questionId = questionLine
      .toLowerCase()
      .replace(/[?]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    
    // Extract answer (skip "_No answer provided_")
    if (answerLines && !answerLines.startsWith('_No answer provided_')) {
      answers[questionId] = answerLines;
    }
  });
  
  return answers;
}

// Check if a project exists
export async function checkProjectExists(projectName: string): Promise<boolean> {
  try {
    const projectPath = await getProjectPath(projectName);
    return await exists(projectPath);
  } catch (error) {
    console.error('Error checking project existence:', error);
    return false;
  }
}

// Load all project data from files
export async function loadProjectData(projectName: string): Promise<Record<string, Record<string, string>>> {
  const allSections: Record<string, Record<string, string>> = {};
  
  const fileMapping: Record<string, string> = {
    'Overview': 'Intent.md',
    'Features': 'AppSpec.md',
    'Data': 'DataSpec.md',
    'Access & Rules': 'Rules.md',
    'Assumptions': 'Assumptions.md',
    'Plan Status': 'Tasks.json',
  };
  
  try {
    for (const [section, filename] of Object.entries(fileMapping)) {
      if (filename.endsWith('.json')) {
        // Load JSON file
        const content = await readSectionFromFile(projectName, filename);
        if (content) {
          try {
            allSections[section] = JSON.parse(content);
          } catch (e) {
            console.error(`Error parsing ${filename}:`, e);
            allSections[section] = {};
          }
        } else {
          allSections[section] = {};
        }
      } else {
        // Load and parse markdown file
        const content = await readSectionFromFile(projectName, filename);
        if (content) {
          allSections[section] = parseMarkdownFile(content);
        } else {
          allSections[section] = {};
        }
      }
    }
  } catch (error) {
    console.error('Error loading project data:', error);
  }
  
  return allSections;
}
