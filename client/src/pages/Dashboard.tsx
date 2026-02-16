import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabBar from '../components/TabBar';
import DocumentList from '../components/DocumentList';
import PDFViewer from '../components/PDFViewer';
import ThemeSettings from '../components/ThemeSettings';
import SuperadminAuditPanel from '../components/SuperadminAuditPanel';
import { getTabs, getDocuments } from '../services/api';
import {
  getOfflineDocumentsByTab,
  getOfflineSnapshotMeta,
  getOfflineTabs,
  hasOfflineAgendaSnapshot,
  syncOfflineAgenda
} from '../services/offlineAgenda';
import type { Tab, Document } from '../types';
import { getUser } from '../utils/auth';
import '../styles/Dashboard.css';

interface DashboardProps {
  onLogout: () => void;
}

const formatOfflineSyncDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function Dashboard({ onLogout }: DashboardProps) {
  const user = getUser();
  const canConfigureThemes = user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const isDirector = user?.role === 'reader';

  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showSuperadminAudit, setShowSuperadminAudit] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  const [isOnline, setIsOnline] = useState<boolean>(window.navigator.onLine);
  const [isUsingOfflineData, setIsUsingOfflineData] = useState(false);
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const [offlineSyncMessage, setOfflineSyncMessage] = useState('');
  const [offlineSyncError, setOfflineSyncError] = useState('');
  const [offlineMeta, setOfflineMeta] = useState(getOfflineSnapshotMeta());

  useEffect(() => {
    loadTabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!loading && isDirector && isOnline && isUsingOfflineData) {
      loadTabs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    if (!isDirector || !isOnline || offlineSyncing) {
      return;
    }

    let cancelled = false;

    const syncInBackground = async () => {
      try {
        const result = await runOfflineSync(false);
        if (cancelled || !result) {
          return;
        }

        if (result.downloadedCount > 0) {
          setOfflineSyncMessage(
            `Copia offline actualizada automáticamente (${result.downloadedCount} archivo(s) nuevos/actualizados).`
          );
        }
      } catch {
        // Evitar ruido visual en sincronización automática.
      }
    };

    syncInBackground();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirector, isOnline]);

  useEffect(() => {
    if (activeTab > 0) {
      loadDocuments(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const applyDocumentsState = (docs: Document[], tabId: number) => {
    setDocuments(docs);
    setSelectedDocument((current) => {
      if (docs.length === 0) {
        return null;
      }

      if (current && current.tab_id === tabId) {
        const stillExists = docs.find((doc) => doc.id === current.id);
        if (stillExists) {
          return stillExists;
        }
      }

      return docs[0];
    });
  };

  const applyOfflineState = (preferredTabId?: number): boolean => {
    const offlineTabs = getOfflineTabs();
    setTabs(offlineTabs);
    setOfflineMeta(getOfflineSnapshotMeta());

    if (offlineTabs.length === 0) {
      setActiveTab(0);
      applyDocumentsState([], 0);
      return false;
    }

    const tabId =
      preferredTabId && offlineTabs.some((tab) => tab.id === preferredTabId)
        ? preferredTabId
        : offlineTabs[0].id;

    setActiveTab(tabId);
    const offlineDocuments = getOfflineDocumentsByTab(tabId);
    applyDocumentsState(offlineDocuments, tabId);
    return true;
  };

  const loadTabs = async () => {
    const canUseOffline = isDirector && hasOfflineAgendaSnapshot();

    if (isDirector && !window.navigator.onLine && canUseOffline) {
      applyOfflineState();
      setIsUsingOfflineData(true);
      setLoading(false);
      return;
    }

    try {
      const tabsData = await getTabs();
      setTabs(tabsData);
      setIsUsingOfflineData(false);

      if (tabsData.length > 0) {
        setActiveTab(tabsData[0].id);
      } else {
        setActiveTab(0);
        applyDocumentsState([], 0);
      }
    } catch (error) {
      if (canUseOffline) {
        const loaded = applyOfflineState();
        if (loaded) {
          setIsUsingOfflineData(true);
        }
      } else {
        console.error('Error cargando pestañas:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (tabId: number) => {
    const canUseOffline = isDirector && hasOfflineAgendaSnapshot();
    const shouldForceOffline = isDirector && (!window.navigator.onLine || isUsingOfflineData);

    if (shouldForceOffline && canUseOffline) {
      const offlineDocuments = getOfflineDocumentsByTab(tabId);
      applyDocumentsState(offlineDocuments, tabId);
      return;
    }

    try {
      const docs = await getDocuments(tabId);
      applyDocumentsState(docs, tabId);
      setIsUsingOfflineData(false);
    } catch (error) {
      if (canUseOffline) {
        const offlineDocuments = getOfflineDocumentsByTab(tabId);
        applyDocumentsState(offlineDocuments, tabId);
        setIsUsingOfflineData(true);
      } else {
        console.error('Error cargando documentos:', error);
      }
    }
  };

  const handleTabChange = (tabId: number) => {
    setActiveTab(tabId);
    setSelectedDocument(null);
  };

  const handleDocumentsChange = () => {
    loadDocuments(activeTab);
  };

  const handleTabsChange = (updatedTabs: Tab[]) => {
    setTabs(updatedTabs);
    setSelectedDocument(null);

    if (updatedTabs.length === 0) {
      setActiveTab(0);
      setDocuments([]);
      return;
    }

    const activeTabExists = updatedTabs.some((tab) => tab.id === activeTab);
    if (!activeTabExists) {
      setActiveTab(updatedTabs[0].id);
    }
  };

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc);

    if (window.innerWidth <= 680) {
      setIsSidebarVisible(false);
    }
  };

  const runOfflineSync = async (showFeedback: boolean) => {
    if (!window.navigator.onLine) {
      if (showFeedback) {
        setOfflineSyncError('Para sincronizar la copia offline necesita conexión a la red del sistema.');
      }
      throw new Error('Para sincronizar la copia offline necesita conexión a la red del sistema.');
    }

    setOfflineSyncing(true);
    setOfflineSyncError('');
    if (showFeedback) {
      setOfflineSyncMessage('');
    }

    try {
      const result = await syncOfflineAgenda();
      setOfflineMeta(getOfflineSnapshotMeta());
      if (showFeedback) {
        setOfflineSyncMessage(
          `Copia actualizada. ${result.totalDocuments} PDF(s), ${result.downloadedCount} descargado(s), ${result.skippedCount} reutilizado(s).`
        );
      }

      if (isUsingOfflineData) {
        applyOfflineState(activeTab);
      }

      return result;
    } catch (error: any) {
      if (showFeedback) {
        setOfflineSyncError(error?.message || 'No se pudo sincronizar la copia offline.');
      }
      throw error;
    } finally {
      setOfflineSyncing(false);
    }
  };

  const handleOfflineSync = async () => {
    try {
      await runOfflineSync(true);
    } catch {
      // El mensaje ya se gestiona en runOfflineSync(true).
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner large"></div>
        <p>Cargando aplicación...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Header
        onLogout={onLogout}
        isAdmin={canConfigureThemes}
        isThemeSettingsOpen={showThemeSettings}
        onToggleThemeSettings={() => {
          setShowThemeSettings((previous) => !previous);
          setShowSuperadminAudit(false);
        }}
        isSuperadminAuditOpen={showSuperadminAudit}
        onToggleSuperadminAudit={
          isSuperadmin
            ? () => {
                setShowSuperadminAudit((previous) => !previous);
                setShowThemeSettings(false);
              }
            : undefined
        }
      />

      {isDirector && (
        <section className={`offline-sync-bar ${isUsingOfflineData ? 'offline-copy-active' : ''}`}>
          <div className="offline-sync-status">
            <span className={`offline-sync-dot ${isOnline ? 'online' : 'offline'}`} aria-hidden="true"></span>
            <span className="offline-sync-text">{isOnline ? 'Conexión activa' : 'Sin conexión'}</span>
            <span className="offline-sync-mode">
              {isUsingOfflineData ? 'Visualizando copia offline' : 'Visualizando agenda en línea'}
            </span>
            {offlineMeta ? (
              <span className="offline-sync-meta">
                Última copia: {formatOfflineSyncDate(offlineMeta.syncedAt)} ({offlineMeta.totalDocuments} PDF)
              </span>
            ) : (
              <span className="offline-sync-meta warning">Sin copia offline disponible</span>
            )}
          </div>
          <div className="offline-sync-actions">
            <button
              type="button"
              className="offline-sync-button"
              onClick={handleOfflineSync}
              disabled={offlineSyncing || !isOnline}
            >
              {offlineSyncing ? 'Sincronizando...' : 'Sincronizar copia offline'}
            </button>
          </div>
        </section>
      )}

      {isDirector && (offlineSyncMessage || offlineSyncError) && (
        <section className="offline-sync-feedback">
          {offlineSyncMessage && <p className="offline-sync-success">{offlineSyncMessage}</p>}
          {offlineSyncError && <p className="offline-sync-error">{offlineSyncError}</p>}
        </section>
      )}

      {showThemeSettings && canConfigureThemes ? (
        <section className="theme-settings-screen">
          <div className="theme-settings-panel">
            <ThemeSettings tabs={tabs} activeTab={activeTab} onTabsChange={handleTabsChange} />
          </div>
        </section>
      ) : showSuperadminAudit && isSuperadmin ? (
        <section className="superadmin-audit-screen">
          <div className="superadmin-audit-panel">
            <SuperadminAuditPanel />
          </div>
        </section>
      ) : (
        <>
          <TabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

          <div className={`dashboard-content ${isSidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'}`}>
            <aside className={`sidebar ${isSidebarVisible ? 'visible' : 'collapsed'}`}>
              <button
                type="button"
                className={`sidebar-toggle-handle ${isSidebarVisible ? '' : 'sidebar-toggle-collapsed'}`}
                onClick={() => setIsSidebarVisible((current) => !current)}
                title={isSidebarVisible ? 'Ocultar documentos' : 'Mostrar documentos'}
                aria-label={isSidebarVisible ? 'Ocultar documentos' : 'Mostrar documentos'}
              >
                <span className="sidebar-toggle-icon" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d={isSidebarVisible ? 'M12.5 4.5L7 10L12.5 15.5' : 'M7.5 4.5L13 10L7.5 15.5'}
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {isSidebarVisible && (
                <DocumentList
                  documents={documents}
                  activeTab={activeTab}
                  selectedDocument={selectedDocument}
                  onDocumentSelect={handleDocumentSelect}
                  onDocumentsChange={handleDocumentsChange}
                />
              )}
            </aside>

            <main className="main-content">
              <PDFViewer document={selectedDocument} />
            </main>
          </div>
        </>
      )}
    </div>
  );
}
