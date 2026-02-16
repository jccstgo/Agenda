import { useEffect, useMemo, useState } from 'react';
import {
  createTab,
  deleteTab,
  updateTabs,
  getSuperadminTabAssignments,
  updateSuperadminTabAssignments,
  createSuperadminUser,
  getSuperadminUsers,
  updateSuperadminUsername,
  changeSuperadminUserPassword,
  changeSuperadminUserRole,
  deleteSuperadminUser
} from '../services/api';
import type {
  Tab,
  SuperadminTabAssignableUser,
  SuperadminTabAssignment,
  SuperadminManagedUser
} from '../types';
import { getUser } from '../utils/auth';
import '../styles/ThemeSettings.css';

interface ThemeSettingsProps {
  tabs: Tab[];
  activeTab: number;
  onTabsChange: (tabs: Tab[]) => void;
}

type ManageableRole = 'admin' | 'reader';

interface UserEditDraft {
  username: string;
  role: ManageableRole;
  newPassword: string;
}

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ');
const normalizeUsername = (username: string): string => username.trim();
const isValidUsername = (username: string): boolean => /^[A-Za-z0-9._-]+$/.test(username);

const normalizeAssignmentTabs = (tabs: SuperadminTabAssignment[]): SuperadminTabAssignment[] =>
  [...tabs]
    .map((tab) => ({
      ...tab,
      userIds: Array.from(new Set(tab.userIds)).sort((a, b) => a - b)
    }))
    .sort((a, b) => a.order_index - b.order_index || a.id - b.id);

const getManageableRole = (role: SuperadminManagedUser['role']): ManageableRole => {
  return role === 'admin' ? 'admin' : 'reader';
};

export default function ThemeSettings({ tabs, activeTab, onTabsChange }: ThemeSettingsProps) {
  const [editableTabs, setEditableTabs] = useState<Tab[]>(tabs);
  const [newTabName, setNewTabName] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [assignmentUsers, setAssignmentUsers] = useState<SuperadminTabAssignableUser[]>([]);
  const [assignmentTabs, setAssignmentTabs] = useState<SuperadminTabAssignment[]>([]);
  const [savedAssignmentTabs, setSavedAssignmentTabs] = useState<SuperadminTabAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');

  const [managedUsers, setManagedUsers] = useState<SuperadminManagedUser[]>([]);
  const [userDrafts, setUserDrafts] = useState<Record<number, UserEditDraft>>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [usersError, setUsersError] = useState('');

  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<ManageableRole>('admin');
  const [creatingUser, setCreatingUser] = useState(false);

  const currentUserId = getUser()?.id || null;

  useEffect(() => {
    setEditableTabs(tabs);
  }, [tabs]);

  const loadAssignments = async () => {
    setLoadingAssignments(true);
    setAssignmentsError('');
    try {
      const response = await getSuperadminTabAssignments();
      const normalizedTabs = normalizeAssignmentTabs(response.tabs);
      setAssignmentUsers(response.users);
      setAssignmentTabs(normalizedTabs);
      setSavedAssignmentTabs(normalizedTabs);
    } catch (error: any) {
      setAssignmentsError(error.response?.data?.error || 'No se pudieron cargar los permisos por tema.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError('');
    try {
      const response = await getSuperadminUsers();
      setManagedUsers(response.users);
      setUserDrafts((previous) => {
        const nextDrafts: Record<number, UserEditDraft> = {};
        response.users.forEach((user) => {
          if (user.role === 'superadmin') {
            return;
          }

          const existingDraft = previous[user.id];
          nextDrafts[user.id] = {
            username: existingDraft?.username ?? user.username,
            role: existingDraft?.role ?? getManageableRole(user.role),
            newPassword: ''
          };
        });
        return nextDrafts;
      });
    } catch (error: any) {
      setUsersError(error.response?.data?.error || 'No se pudo cargar la lista de usuarios.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadAssignments();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  const hasChanges = useMemo(() => {
    if (editableTabs.length !== tabs.length) return true;

    return editableTabs.some((tab, index) => {
      const originalTab = tabs[index];
      if (!originalTab) return true;

      return tab.id !== originalTab.id || normalizeName(tab.name) !== normalizeName(originalTab.name);
    });
  }, [editableTabs, tabs]);

  const hasInvalidNames = useMemo(
    () => editableTabs.some((tab) => !normalizeName(tab.name)),
    [editableTabs]
  );

  const assignmentsChanged = useMemo(() => {
    return (
      JSON.stringify(normalizeAssignmentTabs(assignmentTabs)) !==
      JSON.stringify(normalizeAssignmentTabs(savedAssignmentTabs))
    );
  }, [assignmentTabs, savedAssignmentTabs]);

  const moveTab = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editableTabs.length) {
      return;
    }

    setEditableTabs((previous) => {
      const updated = [...previous];
      const [item] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, item);
      return updated;
    });
  };

  const handleNameChange = (tabId: number, value: string) => {
    setEditableTabs((previous) =>
      previous.map((tab) => (tab.id === tabId ? { ...tab, name: value } : tab))
    );
  };

  const handleSave = async () => {
    if (hasInvalidNames) {
      alert('Todos los temas deben tener un nombre válido.');
      return;
    }

    setSaving(true);
    try {
      const updatedTabs = await updateTabs(
        editableTabs.map((tab) => ({
          id: tab.id,
          name: normalizeName(tab.name)
        }))
      );
      onTabsChange(updatedTabs);
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudieron guardar los cambios de temas.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const name = normalizeName(newTabName);
    if (!name) {
      alert('Ingrese un nombre para el nuevo tema.');
      return;
    }

    setCreating(true);
    try {
      const newTab = await createTab(name);
      const updatedTabs = [...tabs, newTab].sort((a, b) => a.order_index - b.order_index);
      onTabsChange(updatedTabs);
      setNewTabName('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo crear el tema.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tabId: number, tabName: string) => {
    if (tabs.length <= 1) {
      alert('Debe existir al menos un tema.');
      return;
    }

    const confirmed = confirm(
      `¿Desea eliminar el tema "${tabName}"?\n\nSe eliminarán también todos los documentos asociados a este tema.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(tabId);
    try {
      const updatedTabs = await deleteTab(tabId);
      onTabsChange(updatedTabs);
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo eliminar el tema.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleAssignment = (tabId: number, userId: number, checked: boolean) => {
    setAssignmentTabs((previous) =>
      previous.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }

        const nextUserIds = checked
          ? Array.from(new Set([...tab.userIds, userId]))
          : tab.userIds.filter((entry) => entry !== userId);

        return {
          ...tab,
          userIds: nextUserIds.sort((a, b) => a - b)
        };
      })
    );
  };

  const handleSaveAssignments = async () => {
    setSavingAssignments(true);
    setAssignmentsError('');
    try {
      const payload = assignmentTabs.map((tab) => ({
        tabId: tab.id,
        userIds: tab.userIds
      }));
      const response = await updateSuperadminTabAssignments(payload);
      const normalizedTabs = normalizeAssignmentTabs(response.tabs);
      setAssignmentUsers(response.users);
      setAssignmentTabs(normalizedTabs);
      setSavedAssignmentTabs(normalizedTabs);
    } catch (error: any) {
      setAssignmentsError(error.response?.data?.error || 'No se pudieron guardar los permisos por tema.');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleCreateUser = async () => {
    const username = normalizeUsername(newUserUsername);
    const password = newUserPassword;

    if (!username) {
      alert('Ingrese un nombre de usuario.');
      return;
    }

    if (username.length < 3 || username.length > 40 || !isValidUsername(username)) {
      alert('El usuario debe tener entre 3 y 40 caracteres y solo letras, números, punto, guion o guion bajo.');
      return;
    }

    if (!password || password.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setCreatingUser(true);
    try {
      const response = await createSuperadminUser({
        username,
        password,
        role: newUserRole
      });
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole('admin');
      await Promise.all([loadAssignments(), loadUsers()]);
      alert(response.message);
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo crear el usuario.');
    } finally {
      setCreatingUser(false);
    }
  };

  const updateUserDraft = (userId: number, patch: Partial<UserEditDraft>) => {
    setUserDrafts((previous) => {
      const current = previous[userId];
      if (!current) {
        return previous;
      }

      return {
        ...previous,
        [userId]: {
          ...current,
          ...patch
        }
      };
    });
  };

  const handleSaveUser = async (user: SuperadminManagedUser) => {
    if (user.role === 'superadmin') {
      alert('El super administrador no se puede editar desde este panel.');
      return;
    }

    const draft = userDrafts[user.id];
    if (!draft) {
      return;
    }

    const nextUsername = normalizeUsername(draft.username);

    if (!nextUsername) {
      alert('El nombre de usuario es obligatorio.');
      return;
    }

    if (nextUsername.length < 3 || nextUsername.length > 40 || !isValidUsername(nextUsername)) {
      alert('El usuario debe tener entre 3 y 40 caracteres y solo letras, números, punto, guion o guion bajo.');
      return;
    }

    if (draft.newPassword && draft.newPassword.length < 8) {
      alert('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const usernameChanged = nextUsername !== user.username;
    const roleChanged = draft.role !== user.role;
    const passwordChanged = draft.newPassword.length > 0;

    if (!usernameChanged && !roleChanged && !passwordChanged) {
      alert('No hay cambios para guardar en este usuario.');
      return;
    }

    setSavingUserId(user.id);
    try {
      if (usernameChanged) {
        await updateSuperadminUsername(user.id, nextUsername);
      }

      if (roleChanged) {
        await changeSuperadminUserRole(user.id, draft.role);
      }

      if (passwordChanged) {
        await changeSuperadminUserPassword(user.id, draft.newPassword);
      }

      await Promise.all([loadAssignments(), loadUsers()]);
      alert('Usuario actualizado correctamente.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo actualizar el usuario.');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeleteUser = async (user: SuperadminManagedUser) => {
    if (user.role === 'superadmin') {
      alert('No se puede eliminar el super administrador.');
      return;
    }

    const confirmed = confirm(`¿Desea eliminar el usuario "${user.username}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    try {
      const response = await deleteSuperadminUser(user.id);
      await Promise.all([loadAssignments(), loadUsers()]);
      alert(response.message);
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo eliminar el usuario.');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <section className="theme-settings">
      <div className="theme-settings-header">
        <h2>Configuración de temas y usuarios</h2>
      </div>

      <div className="theme-settings-list">
        {editableTabs.map((tab, index) => (
          <div key={tab.id} className={`theme-row ${activeTab === tab.id ? 'active' : ''}`}>
            <div className="theme-row-move">
              <button
                type="button"
                className="theme-icon-button"
                onClick={() => moveTab(index, 'up')}
                disabled={index === 0 || saving}
                title="Subir tema"
              >
                ↑
              </button>
              <button
                type="button"
                className="theme-icon-button"
                onClick={() => moveTab(index, 'down')}
                disabled={index === editableTabs.length - 1 || saving}
                title="Bajar tema"
              >
                ↓
              </button>
            </div>

            <input
              type="text"
              value={tab.name}
              onChange={(event) => handleNameChange(tab.id, event.target.value)}
              className="theme-name-input"
              maxLength={120}
              placeholder="Nombre del tema"
              disabled={saving}
            />

            <button
              type="button"
              className="theme-delete-button"
              onClick={() => handleDelete(tab.id, tab.name)}
              disabled={tabs.length <= 1 || saving || deletingId === tab.id}
              title="Eliminar tema"
            >
              {deletingId === tab.id ? '...' : 'Eliminar'}
            </button>
          </div>
        ))}
      </div>

      <div className="theme-create-row">
        <input
          type="text"
          value={newTabName}
          onChange={(event) => setNewTabName(event.target.value)}
          className="theme-name-input"
          maxLength={120}
          placeholder="Nuevo tema"
          disabled={creating || saving}
        />
        <button
          type="button"
          className="theme-create-button"
          onClick={handleCreate}
          disabled={!normalizeName(newTabName) || creating || saving}
        >
          {creating ? 'Creando...' : 'Agregar'}
        </button>
      </div>

      <button
        type="button"
        className="theme-save-button"
        onClick={handleSave}
        disabled={!hasChanges || hasInvalidNames || saving}
      >
        {saving ? 'Guardando...' : 'Guardar ajustes de temas'}
      </button>

      <section className="theme-access-section">
        <div className="theme-access-header">
          <h3>Gestión de usuarios</h3>
          <p>
            Aquí puede dar de alta usuarios, modificar usuario/contraseña/rol o eliminarlos. Los usuarios admin pueden
            asignarse a uno o varios temas.
          </p>
        </div>

        <div className="theme-user-create-row">
          <input
            type="text"
            value={newUserUsername}
            onChange={(event) => setNewUserUsername(event.target.value)}
            className="theme-name-input"
            placeholder="Nuevo usuario"
            maxLength={40}
            disabled={creatingUser}
          />
          <input
            type="password"
            value={newUserPassword}
            onChange={(event) => setNewUserPassword(event.target.value)}
            className="theme-name-input"
            placeholder="Contraseña inicial"
            minLength={8}
            disabled={creatingUser}
          />
          <select
            value={newUserRole}
            onChange={(event) => setNewUserRole(event.target.value as ManageableRole)}
            className="theme-role-select"
            disabled={creatingUser}
          >
            <option value="admin">Administrador</option>
            <option value="reader">Director</option>
          </select>
          <button
            type="button"
            className="theme-create-button"
            onClick={handleCreateUser}
            disabled={creatingUser || !newUserUsername.trim() || newUserPassword.length < 8}
          >
            {creatingUser ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>

        {usersError && <p className="theme-access-error">{usersError}</p>}

        {loadingUsers ? (
          <p className="theme-access-empty">Cargando usuarios...</p>
        ) : managedUsers.length === 0 ? (
          <p className="theme-access-empty">No hay usuarios disponibles.</p>
        ) : (
          <div className="theme-users-table-wrapper">
            <table className="theme-users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Nueva contraseña</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {managedUsers.map((user) => {
                  const isSuperadmin = user.role === 'superadmin';
                  const draft = userDrafts[user.id] || {
                    username: user.username,
                    role: getManageableRole(user.role),
                    newPassword: ''
                  };
                  const isSavingUser = savingUserId === user.id;
                  const isDeletingUser = deletingUserId === user.id;
                  const isBusy = isSavingUser || isDeletingUser;

                  return (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="text"
                          value={isSuperadmin ? user.username : draft.username}
                          onChange={(event) => updateUserDraft(user.id, { username: event.target.value })}
                          className="theme-name-input"
                          disabled={isSuperadmin || isBusy}
                        />
                      </td>
                      <td>
                        <select
                          value={isSuperadmin ? 'superadmin' : draft.role}
                          onChange={(event) =>
                            updateUserDraft(user.id, { role: event.target.value as ManageableRole })
                          }
                          className="theme-role-select"
                          disabled={isSuperadmin || isBusy}
                        >
                          {isSuperadmin ? (
                            <option value="superadmin">Super Administrador</option>
                          ) : (
                            <>
                              <option value="admin">Administrador</option>
                              <option value="reader">Director</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td>
                        {isSuperadmin ? (
                          <span className="theme-user-readonly">No editable</span>
                        ) : (
                          <input
                            type="password"
                            value={draft.newPassword}
                            onChange={(event) => updateUserDraft(user.id, { newPassword: event.target.value })}
                            className="theme-name-input"
                            placeholder="Opcional (mín. 8)"
                            minLength={8}
                            disabled={isBusy}
                          />
                        )}
                      </td>
                      <td>
                        <div className="theme-user-actions">
                          <button
                            type="button"
                            className="theme-user-save-button"
                            onClick={() => handleSaveUser(user)}
                            disabled={isSuperadmin || isBusy}
                          >
                            {isSavingUser ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            className="theme-user-delete-button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={
                              isSuperadmin ||
                              isBusy ||
                              (currentUserId !== null && currentUserId === user.id)
                            }
                          >
                            {isDeletingUser ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="theme-access-header theme-access-subheader">
          <h3>Permisos por tema</h3>
          <p>Seleccione qué usuarios administradores pueden subir o eliminar documentos en cada tema.</p>
        </div>

        <div className="theme-access-actions">
          <button
            type="button"
            className="theme-icon-button theme-access-refresh"
            onClick={loadAssignments}
            disabled={loadingAssignments || savingAssignments}
            title="Recargar permisos"
          >
            {loadingAssignments ? '...' : '↻'}
          </button>
          <button
            type="button"
            className="theme-save-button"
            onClick={handleSaveAssignments}
            disabled={!assignmentsChanged || loadingAssignments || savingAssignments}
          >
            {savingAssignments ? 'Guardando permisos...' : 'Guardar permisos por tema'}
          </button>
        </div>

        {assignmentsError && <p className="theme-access-error">{assignmentsError}</p>}

        {loadingAssignments ? (
          <p className="theme-access-empty">Cargando permisos...</p>
        ) : assignmentUsers.length === 0 ? (
          <p className="theme-access-empty">No hay usuarios administradores para asignar.</p>
        ) : assignmentTabs.length === 0 ? (
          <p className="theme-access-empty">No hay temas para asignar.</p>
        ) : (
          <div className="theme-access-table-wrapper">
            <table className="theme-access-table">
              <thead>
                <tr>
                  <th>Tema</th>
                  {assignmentUsers.map((user) => (
                    <th key={user.id}>{user.username}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignmentTabs.map((tab) => (
                  <tr key={tab.id}>
                    <td className="theme-access-theme-name">{tab.name}</td>
                    {assignmentUsers.map((user) => {
                      const checked = tab.userIds.includes(user.id);
                      return (
                        <td key={user.id}>
                          <label className="theme-access-checkbox">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleAssignment(tab.id, user.id, event.target.checked)}
                            />
                            <span>{checked ? 'Sí' : 'No'}</span>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
