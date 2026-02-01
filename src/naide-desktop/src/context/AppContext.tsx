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
  projectLoaded: boolean;
}

interface AppContextType {
  state: AppState;
  updateSectionAnswer: (section: string, questionId: string, value: string) => void;
  getSectionAnswer: (section: string, questionId: string) => string;
  setProjectName: (name: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (projectName: string) => Promise<boolean>;
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
    projectLoaded: false,
  });

  // Initialize project on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeProject(state.projectName);
      } catch (error) {
        console.error('Failed to initialize project:', error);
      }
    };
    init();
  }, [state.projectName]);

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

  const saveProject = useCallback(async () => {
    try {
      console.log('[AppContext] Starting saveProject for:', state.projectName);
      console.log('[AppContext] Sections to save:', Object.keys(state.sections));
      
      // We'll need to pass section questions from the component
      // For now, save the raw data and format it simply
      for (const [section, filename] of Object.entries(sectionFileMapping)) {
        const sectionData = state.sections[section] || {};
        console.log(`[AppContext] Processing section "${section}" (${filename}):`, Object.keys(sectionData).length, 'answers');
        
        if (filename.endsWith('.json')) {
          // For JSON files (like Tasks.json), save as JSON
          const content = JSON.stringify(sectionData, null, 2);
          await saveSectionToFile(state.projectName, filename, content);
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
          await saveSectionToFile(state.projectName, filename, markdownWithFooter);
        }
      }
      console.log('[AppContext] saveProject completed successfully');
      
      // Update config with last used project
      const projectPath = await getProjectPath(state.projectName);
      await updateLastUsedProject(projectPath);
      console.log('[AppContext] Updated last used project in config');
      
      // Also save to global settings (OS-specific location)
      await saveLastProject(projectPath);
      console.log('[AppContext] Saved last used project to global settings');
    } catch (error) {
      console.error('[AppContext] Error saving project:', error);
      throw error;
    }
  }, [state.projectName, state.sections]);

  const loadProject = useCallback(async (projectName: string): Promise<boolean> => {
    try {
      const projectExists = await checkProjectExists(projectName);
      if (!projectExists) {
        console.log(`Project ${projectName} does not exist`);
        return false;
      }

      const projectData = await loadProjectData(projectName);
      setState(prev => ({
        ...prev,
        projectName,
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
      return await checkProjectExists(state.projectName);
    } catch (error) {
      console.error('Error checking for existing project:', error);
      return false;
    }
  }, [state.projectName]);

  const value: AppContextType = {
    state,
    updateSectionAnswer,
    getSectionAnswer,
    setProjectName,
    saveProject,
    loadProject,
    checkForExistingProject,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
