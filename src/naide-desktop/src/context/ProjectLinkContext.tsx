import React, { createContext, useContext } from 'react';

/**
 * Context for providing project link interception configuration.
 * Used by MessageContent to intercept and handle links to project files.
 */
interface ProjectLinkContextValue {
  projectPath: string | null;
  projectLinkDomains: string[];
  currentFilePath?: string | null; // Path of the current markdown file (for relative link resolution)
  onOpenProjectFile: (relativePath: string) => void;
}

const ProjectLinkContext = createContext<ProjectLinkContextValue>({
  projectPath: null,
  projectLinkDomains: [],
  currentFilePath: null,
  onOpenProjectFile: () => {},
});

// Export hook separately
// eslint-disable-next-line react-refresh/only-export-components
export function useProjectLinkContext() {
  return useContext(ProjectLinkContext);
}

// Export provider component
export const ProjectLinkProvider: React.FC<{
  children: React.ReactNode;
  projectPath: string | null;
  projectLinkDomains: string[];
  currentFilePath?: string | null;
  onOpenProjectFile: (relativePath: string) => void;
}> = ({ children, projectPath, projectLinkDomains, currentFilePath, onOpenProjectFile }) => {
  return (
    <ProjectLinkContext.Provider
      value={{ projectPath, projectLinkDomains, currentFilePath, onOpenProjectFile }}
    >
      {children}
    </ProjectLinkContext.Provider>
  );
};
