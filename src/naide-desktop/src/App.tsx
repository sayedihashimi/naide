import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './context/useAppContext';
import Screen1 from './pages/Screen1';
import PlanningMode from './pages/PlanningMode';
import GenerateAppScreen from './pages/GenerateAppScreen';
import { useEffect, useState } from 'react';
import { loadConfig } from './utils/fileSystem';

function AppRoutes() {
  const { checkForExistingProject, loadProject, setProjectName, state } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [hasExistingProject, setHasExistingProject] = useState(false);

  useEffect(() => {
    const checkProject = async () => {
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
            const loaded = await loadProject(projectName);
            setHasExistingProject(loaded);
            console.log('[App] Loaded last used project:', projectName);
          }
        } else {
          console.log('[App] No last used project found');
          // Check for default project
          const exists = await checkForExistingProject();
          if (exists) {
            const loaded = await loadProject(state.projectName);
            setHasExistingProject(loaded);
          }
        }
      } catch (error) {
        console.error('[App] Error checking for existing project:', error);
      } finally {
        setLoading(false);
      }
    };
    checkProject();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-gray-100">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={hasExistingProject ? <Navigate to="/planning" replace /> : <Screen1 />} 
      />
      <Route path="/planning" element={<PlanningMode />} />
      <Route path="/generate" element={<GenerateAppScreen />} />
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

