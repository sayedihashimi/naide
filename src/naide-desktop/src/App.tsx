import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './context/useAppContext';
import GenerateAppScreen from './pages/GenerateAppScreen';
import { useEffect, useState } from 'react';
import { loadConfig, createAllProjectFiles } from './utils/fileSystem';

function AppRoutes() {
  const { checkForExistingProject, loadProject, setProjectName, state } = useAppContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load config to check for last used project
        console.log('[App] Loading config...');
        const config = await loadConfig();
        console.log('[App] Config loaded:', config);
        
        if (config.lastUsedProject) {
          // Extract project name from path
          const parts = config.lastUsedProject.split('/');
          const projectName = parts[parts.length - 1];
          console.log('[App] Last used project:', projectName);
          
          // Set project name
          setProjectName(projectName);
          
          // Check if project exists and load it
          const exists = await checkForExistingProject();
          if (exists) {
            await loadProject(projectName);
            console.log('[App] Loaded last used project:', projectName);
          } else {
            // Create project files if they don't exist
            console.log('[App] Creating project files for:', projectName);
            await createAllProjectFiles(projectName, '');
          }
        } else {
          console.log('[App] No last used project found');
          // Check for default project
          const exists = await checkForExistingProject();
          if (exists) {
            await loadProject(state.projectName);
          } else {
            // Create default project files
            console.log('[App] Creating default project files');
            await createAllProjectFiles(state.projectName, '');
          }
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

