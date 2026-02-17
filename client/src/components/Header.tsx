import { FormEvent, useState } from 'react';
import { clearAuth, getUser } from '../utils/auth';
import { changeOwnPassword } from '../services/api';
import '../styles/Header.css';

interface HeaderProps {
  onLogout: () => void;
  isAdmin?: boolean;
  isThemeSettingsOpen?: boolean;
  onToggleThemeSettings?: () => void;
  isSuperadminAuditOpen?: boolean;
  onToggleSuperadminAudit?: () => void;
}

export default function Header({
  onLogout,
  isAdmin = false,
  isThemeSettingsOpen = false,
  onToggleThemeSettings,
  isSuperadminAuditOpen = false,
  onToggleSuperadminAudit
}: HeaderProps) {
  const user = getUser();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const canChangeOwnPassword = user?.role === 'admin' || user?.role === 'reader';

  const getRoleLabel = () => {
    if (user?.role === 'superadmin') return 'Super Administrador';
    if (user?.role === 'admin') return 'Administrador';
    return 'Director';
  };

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  const resetChangePasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const closeChangePasswordModal = () => {
    setIsChangePasswordOpen(false);
    resetChangePasswordForm();
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Debe completar todos los campos.');
      return;
    }

    if (newPassword.length < 8) {
      alert('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await changeOwnPassword(currentPassword, newPassword);
      alert(response.message);
      closeChangePasswordModal();
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
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
            <span className={`user-role ${user?.role}`}>{getRoleLabel()}</span>
          </div>
          <div className="header-actions">
            {user?.role === 'superadmin' && onToggleSuperadminAudit && (
              <button
                onClick={onToggleSuperadminAudit}
                className={`superadmin-audit-button ${isSuperadminAuditOpen ? 'active' : ''}`}
                title="Abrir auditoría técnica"
              >
                {isSuperadminAuditOpen ? 'Volver a Agenda' : 'Auditoría'}
              </button>
            )}
            {isAdmin && onToggleThemeSettings && (
              <button
                onClick={onToggleThemeSettings}
                className={`theme-settings-toggle ${isThemeSettingsOpen ? 'active' : ''}`}
              >
                {isThemeSettingsOpen ? 'Volver a Agenda' : 'Temas y Usuarios'}
              </button>
            )}
            {canChangeOwnPassword && (
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="change-password-button"
                title="Cambiar mi contraseña"
              >
                Mi contraseña
              </button>
            )}
            <button onClick={handleLogout} className="logout-button">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {isChangePasswordOpen && (
        <div className="change-password-modal-backdrop" role="presentation" onClick={closeChangePasswordModal}>
          <div
            className="change-password-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cambiar contraseña"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Cambiar contraseña</h3>
            <p>Actualice su contraseña personal para este usuario.</p>

            <form onSubmit={handleChangePassword} className="change-password-form">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Contraseña actual"
                autoComplete="current-password"
                disabled={changingPassword}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                autoComplete="new-password"
                minLength={8}
                disabled={changingPassword}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirmar nueva contraseña"
                autoComplete="new-password"
                minLength={8}
                disabled={changingPassword}
              />

              <div className="change-password-actions">
                <button
                  type="button"
                  onClick={closeChangePasswordModal}
                  className="change-password-cancel"
                  disabled={changingPassword}
                >
                  Cancelar
                </button>
                <button type="submit" className="change-password-submit" disabled={changingPassword}>
                  {changingPassword ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
