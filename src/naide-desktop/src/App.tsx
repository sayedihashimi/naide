import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Screen1 from './pages/Screen1';
import PlanningMode from './pages/PlanningMode';
import { useEffect, useState } from 'react';

function AppRoutes() {
  const { checkForExistingProject, loadProject, state } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [hasExistingProject, setHasExistingProject] = useState(false);

  useEffect(() => {
    const checkProject = async () => {
      try {
        const exists = await checkForExistingProject();
        if (exists) {
          // Load the existing project
          const loaded = await loadProject(state.projectName);
          setHasExistingProject(loaded);
        }
      } catch (error) {
        console.error('Error checking for existing project:', error);
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

