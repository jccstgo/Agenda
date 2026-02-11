import { useState } from 'react';
import { clearAuth, getUser } from '../utils/auth';
import { resetDefaultPasswordsAsSuperadmin } from '../services/api';
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
  const [resettingPasswords, setResettingPasswords] = useState(false);

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  const handleResetDefaultPasswords = async () => {
    const confirmed = confirm(
      'Esta acción reseteará contraseñas de superadmin/admin/Director a los valores por defecto definidos en Railway. ¿Desea continuar?'
    );

    if (!confirmed) {
      return;
    }

    setResettingPasswords(true);
    try {
      const response = await resetDefaultPasswordsAsSuperadmin();
      const updatedUsers = response.users.map((entry) => `${entry.username} (${entry.role})`).join(', ');
      alert(
        `${response.message}\n\nUsuarios actualizados: ${updatedUsers}\n\nUse los valores DEFAULT_*_PASSWORD en Railway para iniciar sesión.`
      );
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudieron resetear las contraseñas por defecto.');
    } finally {
      setResettingPasswords(false);
    }
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
          {user?.role === 'superadmin' && (
            <button
              onClick={handleResetDefaultPasswords}
              className="superadmin-reset-button"
              disabled={resettingPasswords}
              title="Resetear contraseñas por defecto"
            >
              {resettingPasswords ? 'Reseteando...' : 'Reset Passwords'}
            </button>
          )}
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
