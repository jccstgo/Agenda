import { useState, FormEvent } from 'react';
import { login, resetDefaultPasswordsFromLogin } from '../services/api';
import { saveAuth } from '../utils/auth';
import '../styles/Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const showCredentialsHint = import.meta.env.DEV;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  const handleResetPasswords = async () => {
    const confirmed = confirm(
      'Esta acción temporal reseteará contraseñas por defecto para superadmin, admin y Director. ¿Desea continuar?'
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setResetting(true);
    try {
      const response = await resetDefaultPasswordsFromLogin();
      const usersText = response.users.map((entry) => `${entry.username} (${entry.role})`).join(', ');
      alert(
        `${response.message}\n\nUsuarios sincronizados: ${usersText}\n\nIntente iniciar sesión nuevamente con las credenciales por defecto de Railway.`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron resetear las credenciales.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src="/esg.webp" alt="Logo principal" className="login-logo-image" />
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

          <button
            type="button"
            className="login-reset-button"
            onClick={handleResetPasswords}
            disabled={loading || resetting}
          >
            {resetting ? 'Reseteando credenciales...' : 'Reset Passwords (Temporal)'}
          </button>
        </form>

        {showCredentialsHint && (
          <div className="login-footer">
            <div className="credentials-hint">
              <strong>Usuarios de prueba:</strong>
              <br />
              Admin: <code>admin / admin123</code>
              <br />
              Director: <code>Director / director123</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
