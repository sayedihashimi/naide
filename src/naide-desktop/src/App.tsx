import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './context/useAppContext';
import GenerateAppScreen from './pages/GenerateAppScreen';
import { useEffect, useState } from 'react';
import { initializeProject } from './utils/fileSystem';
import { loadLastProject } from './utils/globalSettings';

function AppRoutes() {
  const { checkForExistingProject, loadProject, setProjectName, setProjectPath, state } = useAppContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load last used project from global settings
        console.log('[App] Loading last project from global settings...');
        const lastProjectPath = await loadLastProject();
        console.log('[App] Last project path:', lastProjectPath);
        
        if (lastProjectPath) {
          // Extract project name from path (handle both / and \ separators)
          const parts = lastProjectPath.split(/[\\/]/);
          const projectName = parts[parts.length - 1];
          console.log('[App] Last used project:', projectName);
          
          // Set project name and path
          setProjectName(projectName);
          setProjectPath(lastProjectPath);
          
          // Check if project exists and load it
          const exists = await checkForExistingProject();
          if (exists) {
            await loadProject(lastProjectPath);
            console.log('[App] Loaded last used project:', projectName);
          } else {
            // Path was valid but project structure may be incomplete
            // Initialize project directory
            console.log('[App] Initializing project directory for:', projectName);
            await initializeProject(projectName, lastProjectPath);
          }
        } else {
          console.log('[App] No valid last project found');
          // No project opened yet - user will need to open one
          // Don't create default project in Documents
        }
      } catch (error) {
        console.error('[App] Error initializing app:', error);
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-gray-100">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<GenerateAppScreen />} />
    </Routes>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;

