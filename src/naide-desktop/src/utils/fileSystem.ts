import { create, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join, documentDir } from '@tauri-apps/api/path';

export interface ProjectConfig {
  name: string;
  path: string;
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
    const projectExists = await exists(projectPath);
    if (!projectExists) {
      // Create project directory (recursively)
      const basePath = await getProjectsBasePath();
      await mkdir(basePath, { recursive: true });
      await mkdir(projectPath);
    }
  } catch (error) {
    console.error('Error initializing project:', error);
    // Don't throw - just log, as this might fail in browser/dev mode
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
    await writeTextFile(filePath, content);
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
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
