import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { initializeProject, saveSectionToFile, formatSectionAsMarkdown } from '../utils/fileSystem';

interface AppState {
  initialIntentText: string;
  planDirty: boolean;
  sections: Record<string, Record<string, string>>;
  projectName: string;
}

interface AppContextType {
  state: AppState;
  setInitialIntent: (text: string) => void;
  setPlanDirty: (dirty: boolean) => void;
  updateSectionAnswer: (section: string, questionId: string, value: string) => void;
  getSectionAnswer: (section: string, questionId: string) => string;
  setProjectName: (name: string) => void;
  saveProject: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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
    initialIntentText: '',
    planDirty: false,
    sections: {},
    projectName: 'MyApp',
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

  const setInitialIntent = useCallback((text: string) => {
    setState(prev => ({ ...prev, initialIntentText: text }));
  }, []);

  const setPlanDirty = useCallback((dirty: boolean) => {
    setState(prev => ({ ...prev, planDirty: dirty }));
  }, []);

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
      planDirty: true,
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
      // We'll need to pass section questions from the component
      // For now, save the raw data and format it simply
      for (const [section, filename] of Object.entries(sectionFileMapping)) {
        const sectionData = state.sections[section] || {};
        
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
          await saveSectionToFile(state.projectName, filename, markdown);
        }
      }
    } catch (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }, [state.projectName, state.sections]);

  const value: AppContextType = {
    state,
    setInitialIntent,
    setPlanDirty,
    updateSectionAnswer,
    getSectionAnswer,
    setProjectName,
    saveProject,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
