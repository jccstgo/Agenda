import { clearAuth, getUser } from '../utils/auth';
import '../styles/Header.css';

interface HeaderProps {
  onLogout: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-placeholder">
          <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Escudo Guerrero */}
            <circle cx="50" cy="50" r="48" fill="white" stroke="#D4AF37" strokeWidth="2"/>
            {/* Perfil de guerrero */}
            <path d="M50 20C45 20 42 25 40 30C38 35 36 40 35 45C34 50 35 55 40 58C45 61 50 60 55 58C60 56 62 52 63 48C64 44 65 40 64 35C63 30 60 25 56 22C54 20 52 20 50 20Z" fill="#6B0F1A"/>
            {/* Ojo */}
            <circle cx="52" cy="42" r="3" fill="#D4AF37"/>
            {/* Plumas decorativas */}
            <path d="M30 28C28 24 26 20 25 16L28 18C29 22 30 26 32 30Z" fill="#6B0F1A"/>
            <path d="M70 28C72 24 74 20 75 16L72 18C71 22 70 26 68 30Z" fill="#6B0F1A"/>
            <path d="M26 35C24 32 22 28 20 25L23 27C24 30 25 33 27 36Z" fill="#6B0F1A"/>
            <path d="M74 35C76 32 78 28 80 25L77 27C76 30 75 33 73 36Z" fill="#6B0F1A"/>
            {/* Detalles del casco */}
            <path d="M35 45C33 42 32 38 32 35L35 37C36 40 37 43 38 46Z" fill="#9B2743" opacity="0.6"/>
            <path d="M65 45C67 42 68 38 68 35L65 37C64 40 63 43 62 46Z" fill="#9B2743" opacity="0.6"/>
          </svg>
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
            {user?.role === 'admin' ? 'Administrador' : 'Lector'}
          </span>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Cerrar Sesión
        </button>
      </div>
    </header>
  );
}
