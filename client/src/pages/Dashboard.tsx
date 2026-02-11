import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabBar from '../components/TabBar';
import DocumentList from '../components/DocumentList';
import PDFViewer from '../components/PDFViewer';
import ThemeSettings from '../components/ThemeSettings';
import { getTabs, getDocuments } from '../services/api';
import type { Tab, Document } from '../types';
import { getUser, isAdmin } from '../utils/auth';
import '../styles/Dashboard.css';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const user = getUser();
  const isUserAdmin = isAdmin(user);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTabs();
  }, []);

  useEffect(() => {
    if (activeTab > 0) {
      loadDocuments(activeTab);
    }
  }, [activeTab]);

  const loadTabs = async () => {
    try {
      const tabsData = await getTabs();
      setTabs(tabsData);
      if (tabsData.length > 0) {
        setActiveTab(tabsData[0].id);
      } else {
        setActiveTab(0);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error cargando pestañas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (tabId: number) => {
    try {
      const docs = await getDocuments(tabId);
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
    } catch (error) {
      console.error('Error cargando documentos:', error);
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

    if (window.innerWidth <= 768) {
      setIsSidebarVisible(false);
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
        isAdmin={isUserAdmin}
        isThemeSettingsOpen={showThemeSettings}
        onToggleThemeSettings={() => setShowThemeSettings((previous) => !previous)}
      />

      {showThemeSettings && isUserAdmin ? (
        <section className="theme-settings-screen">
          <div className="theme-settings-panel">
            <ThemeSettings tabs={tabs} activeTab={activeTab} onTabsChange={handleTabsChange} />
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
                      d="M12.5 4.5L7 10L12.5 15.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="sidebar-toggle-label">
                  {isSidebarVisible ? 'Ocultar' : 'Mostrar'}
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
