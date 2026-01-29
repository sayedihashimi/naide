import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Screen1 from './pages/Screen1';
import PlanningMode from './pages/PlanningMode';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Screen1 />} />
          <Route path="/planning" element={<PlanningMode />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;

