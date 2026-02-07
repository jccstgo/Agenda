import { useState, useEffect } from 'react';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import type { Document } from '../types';
import { getDocumentUrl } from '../services/api';
import '../styles/PDFViewer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configurar worker de pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  document: Document | null;
}

export default function PDFViewer({ document }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfUrl, setPdfUrl] = useState<string>('');

  useEffect(() => {
    if (document) {
      const url = getDocumentUrl(document.filename, document.tab_id);
      setPdfUrl(url);
      setPageNumber(1);
      setScale(1.0);
    }
  }, [document]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  if (!document) {
    return (
      <div className="pdf-viewer">
        <div className="no-document-selected">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
              stroke="#9B2743"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M14 2V8H20" stroke="#9B2743" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>Selecciona un documento para visualizarlo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-header">
        <h2 className="pdf-title">{document.original_name}</h2>
        <div className="pdf-controls">
          <div className="zoom-controls">
            <button onClick={zoomOut} title="Alejar" disabled={scale <= 0.5}>
              −
            </button>
            <button onClick={resetZoom} title="Tamaño original">
              {Math.round(scale * 100)}%
            </button>
            <button onClick={zoomIn} title="Acercar" disabled={scale >= 3.0}>
              +
            </button>
          </div>

          <div className="page-controls">
            <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
              ‹
            </button>
            <span>
              Página {pageNumber} de {numPages}
            </span>
            <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
              ›
            </button>
          </div>

          <a
            href={pdfUrl}
            download={document.original_name}
            className="download-button"
            title="Descargar PDF"
          >
            ⬇ Descargar
          </a>
        </div>
      </div>

      <div className="pdf-content">
        <PDFDocument
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="pdf-loading">
              <div className="spinner"></div>
              <p>Cargando documento...</p>
            </div>
          }
          error={
            <div className="pdf-error">
              <p>Error al cargar el documento</p>
              <button onClick={() => window.location.reload()}>
                Recargar página
              </button>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </PDFDocument>
      </div>
    </div>
  );
}
