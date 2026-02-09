import React, { createContext, useContext } from 'react';

/**
 * Context for providing project link interception configuration.
 * Used by MessageContent to intercept and handle links to project files.
 */
interface ProjectLinkContextValue {
  projectPath: string | null;
  projectLinkDomains: string[];
  onOpenProjectFile: (relativePath: string) => void;
}

const ProjectLinkContext = createContext<ProjectLinkContextValue>({
  projectPath: null,
  projectLinkDomains: [],
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
  onOpenProjectFile: (relativePath: string) => void;
}> = ({ children, projectPath, projectLinkDomains, onOpenProjectFile }) => {
  return (
    <ProjectLinkContext.Provider
      value={{ projectPath, projectLinkDomains, onOpenProjectFile }}
    >
      {children}
    </ProjectLinkContext.Provider>
  );
};
