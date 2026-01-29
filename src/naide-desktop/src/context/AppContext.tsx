import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AppState {
  initialIntentText: string;
  planDirty: boolean;
  sections: Record<string, Record<string, string>>;
}

interface AppContextType {
  state: AppState;
  setInitialIntent: (text: string) => void;
  setPlanDirty: (dirty: boolean) => void;
  updateSectionAnswer: (section: string, questionId: string, value: string) => void;
  getSectionAnswer: (section: string, questionId: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    initialIntentText: '',
    planDirty: false,
    sections: {},
  });

  const setInitialIntent = (text: string) => {
    setState(prev => ({ ...prev, initialIntentText: text }));
  };

  const setPlanDirty = (dirty: boolean) => {
    setState(prev => ({ ...prev, planDirty: dirty }));
  };

  const updateSectionAnswer = (section: string, questionId: string, value: string) => {
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
  };

  const getSectionAnswer = (section: string, questionId: string): string => {
    return state.sections[section]?.[questionId] || '';
  };

  const value: AppContextType = {
    state,
    setInitialIntent,
    setPlanDirty,
    updateSectionAnswer,
    getSectionAnswer,
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
