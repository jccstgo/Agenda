import { useState, useRef } from 'react';
import type { Document } from '../types';
import { uploadDocument, deleteDocument } from '../services/api';
import { isAdmin, getUser } from '../utils/auth';
import '../styles/DocumentList.css';

interface DocumentListProps {
  documents: Document[];
  activeTab: number;
  selectedDocument: Document | null;
  onDocumentSelect: (doc: Document) => void;
  onDocumentsChange: () => void;
}

export default function DocumentList({
  documents,
  activeTab,
  selectedDocument,
  onDocumentSelect,
  onDocumentsChange
}: DocumentListProps) {
  const user = getUser();
  const isUserAdmin = isAdmin(user);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF');
      return;
    }

    setUploading(true);
    try {
      await uploadDocument(activeTab, file);
      onDocumentsChange();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`¿Está seguro de eliminar "${doc.original_name}"?`)) {
      return;
    }

    try {
      await deleteDocument(doc.id);
      onDocumentsChange();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar el archivo');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="document-list">
      <div className="document-list-header">
        <h2>Documentos</h2>
        {isUserAdmin && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" className="upload-button">
              {uploading ? 'Subiendo...' : '+ Subir PDF'}
            </label>
          </div>
        )}
      </div>

      <div className="documents-container">
        {documents.length === 0 ? (
          <div className="no-documents">
            <p>No hay documentos en esta sección</p>
            {isUserAdmin && <p className="hint">Sube un PDF para comenzar</p>}
          </div>
        ) : (
          <div className="documents-grid">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`document-card ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                onClick={() => onDocumentSelect(doc)}
              >
                <div className="document-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                      stroke="#9B2743"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M14 2V8H20" stroke="#9B2743" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <text x="12" y="17" fontSize="8" fill="#6B0F1A" textAnchor="middle" fontWeight="bold">PDF</text>
                  </svg>
                </div>

                <div className="document-info">
                  <h3 className="document-name">{doc.original_name}</h3>
                  <div className="document-meta">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>

                {isUserAdmin && (
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc);
                    }}
                    title="Eliminar documento"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
