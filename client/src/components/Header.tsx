import { clearAuth, getUser } from '../utils/auth';
import '../styles/Header.css';

interface HeaderProps {
  onLogout: () => void;
  isAdmin?: boolean;
  isThemeSettingsOpen?: boolean;
  onToggleThemeSettings?: () => void;
}

export default function Header({
  onLogout,
  isAdmin = false,
  isThemeSettingsOpen = false,
  onToggleThemeSettings
}: HeaderProps) {
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">
          <img src="/esg.webp" alt="Logo principal" className="header-logo-image" />
        </div>
        <div className="header-title">
          <h1>Agenda Digital</h1>
          <p>Sistema de Gestión de Documentos</p>
        </div>
      </div>

      <div className="header-right">
        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className={`user-role ${user?.role}`}>
            {user?.role === 'admin' ? 'Administrador' : 'Principal'}
          </span>
        </div>
        <div className="header-actions">
          {isAdmin && onToggleThemeSettings && (
            <button
              onClick={onToggleThemeSettings}
              className={`theme-settings-toggle ${isThemeSettingsOpen ? 'active' : ''}`}
            >
              {isThemeSettingsOpen ? 'Volver a Agenda' : 'Configurar Temas'}
            </button>
          )}
          <button onClick={handleLogout} className="logout-button">
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
}
