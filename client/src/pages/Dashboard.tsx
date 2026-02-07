import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabBar from '../components/TabBar';
import DocumentList from '../components/DocumentList';
import PDFViewer from '../components/PDFViewer';
import { getTabs, getDocuments } from '../services/api';
import type { Tab, Document } from '../types';
import '../styles/Dashboard.css';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
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
      setSelectedDocument(null);
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
      <Header onLogout={onLogout} />
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="dashboard-content">
        <aside className="sidebar">
          <DocumentList
            documents={documents}
            activeTab={activeTab}
            selectedDocument={selectedDocument}
            onDocumentSelect={setSelectedDocument}
            onDocumentsChange={handleDocumentsChange}
          />
        </aside>

        <main className="main-content">
          <PDFViewer document={selectedDocument} />
        </main>
      </div>
    </div>
  );
}
