import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { getToken, getUser } from './utils/auth';
import { verifyToken } from './services/api';
import { hasOfflineAgendaSnapshot } from './services/offlineAgenda';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = getToken();
    if (token) {
      const isValid = await verifyToken();
      if (isValid) {
        setIsAuthenticated(true);
      } else {
        const cachedUser = getUser();
        const serverReachable = await fetch('/health', { cache: 'no-store' })
          .then((response) => response.ok)
          .catch(() => false);
        const canUseOfflineDirectorMode =
          cachedUser?.role === 'reader' && hasOfflineAgendaSnapshot() && !serverReachable;
        setIsAuthenticated(canUseOfflineDirectorMode);
      }
    }
    setIsLoading(false);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner large"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}
