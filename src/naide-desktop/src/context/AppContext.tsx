import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { 
  initializeProject, 
  saveSectionToFile, 
  loadProjectData, 
  checkProjectExists,
  getProjectPath,
  updateLastUsedProject,
  addMarkdownFooter
} from '../utils/fileSystem';
import { saveLastProject } from '../utils/globalSettings';

interface AppState {
  sections: Record<string, Record<string, string>>;
  projectName: string;
  projectPath: string | null; // Actual opened project directory path
  projectLoaded: boolean;
}

interface AppContextType {
  state: AppState;
  updateSectionAnswer: (section: string, questionId: string, value: string) => void;
  getSectionAnswer: (section: string, questionId: string) => string;
  setProjectName: (name: string) => void;
  setProjectPath: (path: string | null) => void;
  saveProject: () => Promise<void>;
  /** Load a project from the specified directory path */
  loadProject: (projectPath: string) => Promise<boolean>;
  checkForExistingProject: () => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export { AppContext };
export type { AppContextType };

// File mappings
const sectionFileMapping: Record<string, string> = {
  'Overview': 'Intent.md',
  'Features': 'AppSpec.md',
  'Data': 'DataSpec.md',
  'Access & Rules': 'Rules.md',
  'Assumptions': 'Assumptions.md',
  'Plan Status': 'Tasks.json',
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    sections: {},
    projectName: 'MyApp',
    projectPath: null, // Will be set when user opens a project
    projectLoaded: false,
  });

  // Initialize project on mount (only if projectPath is set)
  useEffect(() => {
    const init = async () => {
      try {
        if (state.projectPath) {
          await initializeProject(state.projectName, state.projectPath);
        }
      } catch (error) {
        console.error('Failed to initialize project:', error);
      }
    };
    init();
  }, [state.projectName, state.projectPath]);

  const updateSectionAnswer = useCallback((section: string, questionId: string, value: string) => {
    setState(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: {
          ...prev.sections[section],
          [questionId]: value,
        },
      },
    }));
  }, []);

  const getSectionAnswer = useCallback((section: string, questionId: string): string => {
    return state.sections[section]?.[questionId] || '';
  }, [state.sections]);

  const setProjectName = useCallback((name: string) => {
    setState(prev => ({ ...prev, projectName: name }));
  }, []);

  const setProjectPath = useCallback((path: string | null) => {
    setState(prev => ({ ...prev, projectPath: path }));
  }, []);

  const saveProject = useCallback(async () => {
    try {
      console.log('[AppContext] Starting saveProject for:', state.projectName);
      console.log('[AppContext] Project path:', state.projectPath);
      console.log('[AppContext] Sections to save:', Object.keys(state.sections));
      
      // Use projectPath if available, otherwise fall back to generated path
      const projectPath = state.projectPath || await getProjectPath(state.projectName);
      
      // We'll need to pass section questions from the component
      // For now, save the raw data and format it simply
      for (const [section, filename] of Object.entries(sectionFileMapping)) {
        const sectionData = state.sections[section] || {};
        console.log(`[AppContext] Processing section "${section}" (${filename}):`, Object.keys(sectionData).length, 'answers');
        
        if (filename.endsWith('.json')) {
          // For JSON files (like Tasks.json), save as JSON
          const content = JSON.stringify(sectionData, null, 2);
          await saveSectionToFile(state.projectName, filename, content, projectPath);
        } else {
          // For markdown files, format with question IDs as headings
          let markdown = `# ${section}\n\n`;
          for (const [questionId, answer] of Object.entries(sectionData)) {
            const heading = questionId
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            markdown += `## ${heading}\n\n`;
            if (answer.trim()) {
              markdown += `${answer}\n\n`;
            } else {
              markdown += `_No answer provided_\n\n`;
            }
          }
          // Add footer to markdown files
          const markdownWithFooter = addMarkdownFooter(markdown);
          await saveSectionToFile(state.projectName, filename, markdownWithFooter, projectPath);
        }
      }
      console.log('[AppContext] saveProject completed successfully');
      
      // Update config with last used project
      await updateLastUsedProject(projectPath);
      console.log('[AppContext] Updated last used project in config');
      
      // Also save to global settings (OS-specific location)
      await saveLastProject(projectPath);
      console.log('[AppContext] Saved last used project to global settings');
    } catch (error) {
      console.error('[AppContext] Error saving project:', error);
      throw error;
    }
  }, [state.projectName, state.projectPath, state.sections]);

  const loadProject = useCallback(async (projectPath: string): Promise<boolean> => {
    try {
      // Extract project name from path
      const pathParts = projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      
      const projectExists = await checkProjectExists(projectName, projectPath);
      if (!projectExists) {
        console.log(`Project ${projectName} at ${projectPath} does not exist`);
        return false;
      }

      const projectData = await loadProjectData(projectName, projectPath);
      setState(prev => ({
        ...prev,
        projectName,
        projectPath,
        sections: projectData,
        projectLoaded: true,
      }));
      
      return true;
    } catch (error) {
      console.error('Error loading project:', error);
      return false;
    }
  }, []);

  const checkForExistingProject = useCallback(async (): Promise<boolean> => {
    try {
      const projectPath = state.projectPath || await getProjectPath(state.projectName);
      return await checkProjectExists(state.projectName, projectPath);
    } catch (error) {
      console.error('Error checking for existing project:', error);
      return false;
    }
  }, [state.projectName, state.projectPath]);

  const value: AppContextType = {
    state,
    updateSectionAnswer,
    getSectionAnswer,
    setProjectName,
    setProjectPath,
    saveProject,
    loadProject,
    checkForExistingProject,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
