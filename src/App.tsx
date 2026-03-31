import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppNavbar } from './components/AppNavbar';
import { LandingPage } from './pages/LandingPage';
import { PaperPreviewPage } from './pages/PaperPreviewPage';
import { SearchResultsPage } from './pages/SearchResultsPage';

function AppLayout() {
  const location = useLocation();
  const isPreviewRoute = location.pathname === '/preview';

  return (
    <div className="app-shell">
      <AppNavbar />
      <main className={`page-shell${isPreviewRoute ? ' page-shell--preview' : ''}`}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/results" element={<SearchResultsPage />} />
          <Route path="/preview" element={<PaperPreviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default App;
