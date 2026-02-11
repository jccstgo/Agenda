import { useEffect, useMemo, useState } from 'react';
import { createTab, deleteTab, updateTabs } from '../services/api';
import type { Tab } from '../types';
import '../styles/ThemeSettings.css';

interface ThemeSettingsProps {
  tabs: Tab[];
  activeTab: number;
  onTabsChange: (tabs: Tab[]) => void;
}

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export default function ThemeSettings({ tabs, activeTab, onTabsChange }: ThemeSettingsProps) {
  const [editableTabs, setEditableTabs] = useState<Tab[]>(tabs);
  const [newTabName, setNewTabName] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setEditableTabs(tabs);
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

  return (
    <section className="theme-settings">
      <div className="theme-settings-header">
        <h2>Configuración de temas</h2>
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
        {saving ? 'Guardando...' : 'Guardar ajustes'}
      </button>
    </section>
  );
}
