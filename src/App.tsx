import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppNavbar } from './components/AppNavbar';
import { LandingPage } from './pages/LandingPage';
import { PaperPreviewPage } from './pages/PaperPreviewPage';
import { SearchResultsPage } from './pages/SearchResultsPage';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <AppNavbar />
        <main className="page-shell">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/results" element={<SearchResultsPage />} />
            <Route path="/preview" element={<PaperPreviewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
