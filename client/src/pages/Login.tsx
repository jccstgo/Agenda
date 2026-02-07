import { useState, FormEvent } from 'react';
import { login } from '../services/api';
import { saveAuth } from '../utils/auth';
import '../styles/Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(username, password);
      saveAuth(response.token, response.user);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-placeholder">
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Escudo Guerrero */}
              <circle cx="50" cy="50" r="48" fill="#6B0F1A" stroke="#D4AF37" strokeWidth="2"/>
              {/* Perfil de guerrero */}
              <path d="M50 20C45 20 42 25 40 30C38 35 36 40 35 45C34 50 35 55 40 58C45 61 50 60 55 58C60 56 62 52 63 48C64 44 65 40 64 35C63 30 60 25 56 22C54 20 52 20 50 20Z" fill="#D4AF37"/>
              {/* Ojo */}
              <circle cx="52" cy="42" r="3" fill="#6B0F1A"/>
              {/* Plumas decorativas */}
              <path d="M30 28C28 24 26 20 25 16L28 18C29 22 30 26 32 30Z" fill="#D4AF37"/>
              <path d="M70 28C72 24 74 20 75 16L72 18C71 22 70 26 68 30Z" fill="#D4AF37"/>
              <path d="M26 35C24 32 22 28 20 25L23 27C24 30 25 33 27 36Z" fill="#D4AF37"/>
              <path d="M74 35C76 32 78 28 80 25L77 27C76 30 75 33 73 36Z" fill="#D4AF37"/>
              {/* Detalles del casco */}
              <path d="M35 45C33 42 32 38 32 35L35 37C36 40 37 43 38 46Z" fill="#9B2743" opacity="0.6"/>
              <path d="M65 45C67 42 68 38 68 35L65 37C64 40 63 43 62 46Z" fill="#9B2743" opacity="0.6"/>
            </svg>
          </div>
          <h1>Agenda Digital</h1>
          <p>Sistema de Gestión de Documentos</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingrese su usuario"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="login-footer">
          <div className="credentials-hint">
            <strong>Usuarios de prueba:</strong>
            <br />
            Admin: <code>admin / admin123</code>
            <br />
            Lector: <code>lector / lector123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
