import { useState, useEffect, useRef } from 'react';
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

export default function PDFViewer({ document: selectedDocument }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(900);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDocument) {
      const url = getDocumentUrl(selectedDocument.filename, selectedDocument.tab_id);
      setPdfUrl(url);
      return;
    }

    setNumPages(0);
    setPdfUrl('');
  }, [selectedDocument]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 900;
      setContainerWidth(width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedDocument, isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = window.document.fullscreenElement;
      setIsFullscreen(fullscreenElement === viewerRef.current);
    };

    window.document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => window.document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !isFullscreen) {
      return;
    }

    let touchStartY = 0;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      touchStartY = event.touches[0].clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }

      const currentY = event.touches[0].clientY;
      const deltaY = currentY - touchStartY;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      const isPullingDownAtTop = atTop && deltaY > 0;
      const isPushingUpAtBottom = atBottom && deltaY < 0;

      if (isPullingDownAtTop || isPushingUpAtBottom) {
        event.preventDefault();
      }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
    };
  }, [isFullscreen]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const toggleFullscreen = async () => {
    try {
      if (!window.document.fullscreenElement && viewerRef.current) {
        await viewerRef.current.requestFullscreen();
        return;
      }

      if (window.document.fullscreenElement) {
        await window.document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error al cambiar pantalla completa:', error);
    }
  };

  if (!selectedDocument) {
    return (
      <div className="pdf-viewer" ref={viewerRef}>
        <div className="pdf-header">
          <h2 className="pdf-title">Visor de documentos</h2>
        </div>
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
    <div className={`pdf-viewer ${isFullscreen ? 'fullscreen' : ''}`} ref={viewerRef}>
      <div className="pdf-header">
        <h2 className="pdf-title">{selectedDocument.original_name}</h2>

        <div className="pdf-controls">
          <button className="fullscreen-button" onClick={toggleFullscreen}>
            {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>

          <a
            href={pdfUrl}
            download={selectedDocument.original_name}
            className="download-button"
            title="Descargar PDF"
          >
            ⬇ Descargar
          </a>
        </div>
      </div>

      <div className="pdf-content" ref={contentRef}>
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
          {Array.from({ length: numPages }, (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              width={Math.max(Math.min(containerWidth - 48, 1200), 280)}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          ))}
        </PDFDocument>
      </div>
    </div>
  );
}
