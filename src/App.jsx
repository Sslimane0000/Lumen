import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Library from './pages/Library';
import Reader from './pages/Reader';
import StatsDashboard from './features/stats/StatsDashboard';
import VocabularyLog from './features/dictionary/VocabularyLog';
import Login from './pages/Login';

import { SyncProvider } from './context/SyncContext';

import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <Router basename="/Lumen">
      <SyncProvider>
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/read/:id" element={<Reader />} />
            <Route path="/vocabulary" element={<StatsDashboard initialTab="vocabulary" />} />
            <Route path="/stats" element={<StatsDashboard initialTab="stats" />} />
            <Route path="/settings" element={<StatsDashboard initialTab="settings" />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </SyncProvider>
    </Router>
  );
}

export default App;
