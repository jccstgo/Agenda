import { useEffect, useMemo, useState } from 'react';
import {
  getSuperadminAuditLogs,
  getSuperadminAuditStats
} from '../services/api';
import type {
  SuperadminAuditLog,
  SuperadminAuditLogsQuery,
  SuperadminAuditStatsResponse
} from '../types';
import '../styles/SuperadminAuditPanel.css';

interface FilterDraft {
  userId: string;
  action: string;
  httpMethod: string;
  endpoint: string;
  statusCode: string;
  startDate: string;
  endDate: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const EXPORT_LIMIT = 5000;

const DEFAULT_FILTERS: FilterDraft = {
  userId: '',
  action: '',
  httpMethod: '',
  endpoint: '',
  statusCode: '',
  startDate: '',
  endDate: ''
};

const toNumber = (value: string): number | undefined => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const buildQuery = (filters: FilterDraft, limit: number, offset: number): SuperadminAuditLogsQuery => {
  const query: SuperadminAuditLogsQuery = {
    limit,
    offset
  };

  const userId = toNumber(filters.userId);
  if (userId) {
    query.userId = userId;
  }

  if (filters.action.trim()) {
    query.action = filters.action.trim();
  }

  if (filters.httpMethod.trim()) {
    query.httpMethod = filters.httpMethod.trim().toUpperCase();
  }

  if (filters.endpoint.trim()) {
    query.endpoint = filters.endpoint.trim();
  }

  const statusCode = toNumber(filters.statusCode);
  if (statusCode) {
    query.statusCode = statusCode;
  }

  if (filters.startDate) {
    query.startDate = `${filters.startDate} 00:00:00`;
  }

  if (filters.endDate) {
    query.endDate = `${filters.endDate} 23:59:59`;
  }

  return query;
};

const formatTimestamp = (utcValue: string): string => {
  const date = new Date(utcValue);
  if (Number.isNaN(date.getTime())) {
    return utcValue;
  }
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const parseContext = (rawValue: string | null): unknown => {
  if (!rawValue) {
    return null;
  }
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
};

const sanitizeFilenameSegment = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};

const escapeCsvCell = (value: string | number | null | undefined): string => {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
};

const downloadBlob = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export default function SuperadminAuditPanel() {
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterDraft>(DEFAULT_FILTERS);
  const [logs, setLogs] = useState<SuperadminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [stats, setStats] = useState<SuperadminAuditStatsResponse | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  const actionOptions = useMemo(() => {
    const fromStats = stats?.topActions.map((entry) => entry.action) || [];
    const known = [
      'UPLOAD_DOCUMENT',
      'DELETE_DOCUMENT',
      'VIEW_DOCUMENT',
      'LIST_DOCUMENTS',
      'CREATE_TAB',
      'UPDATE_TABS',
      'DELETE_TAB',
      'RESET_DEFAULT_PASSWORDS',
      'CHANGE_USER_PASSWORD',
      'CHANGE_USER_ROLE',
      'VIEW_AUDIT_LOGS',
      'VIEW_AUDIT_STATS',
      'VIEW_ALL_USERS'
    ];
    return Array.from(new Set([...fromStats, ...known])).sort((a, b) => a.localeCompare(b));
  }, [stats]);

  const loadLogs = async (filtersToApply = appliedFilters, limitToApply = limit, offsetToApply = offset) => {
    setLoadingLogs(true);
    setError('');
    try {
      const response = await getSuperadminAuditLogs(buildQuery(filtersToApply, limitToApply, offsetToApply));
      setLogs(response.logs);
      setTotal(response.total);
      setExpandedLogId(null);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'No se pudieron cargar los registros de auditoría.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const response = await getSuperadminAuditStats();
      setStats(response);
    } catch {
      // No bloquear el panel si falla la tarjeta de estadísticas.
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, limit, offset]);

  useEffect(() => {
    loadStats();
  }, []);

  const handleDraftChange = (field: keyof FilterDraft, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setOffset(0);
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setOffset(0);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const response = await getSuperadminAuditLogs(buildQuery(appliedFilters, EXPORT_LIMIT, 0));
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const actionSegment = sanitizeFilenameSegment(appliedFilters.action || 'all');
      const baseName = `audit-${actionSegment}-${stamp}`;

      if (format === 'json') {
        downloadBlob(`${baseName}.json`, JSON.stringify(response.logs, null, 2), 'application/json');
        return;
      }

      const headers = [
        'id',
        'timestamp_utc',
        'timestamp_cdmx',
        'username',
        'action',
        'resource_type',
        'resource_id',
        'resource_name',
        'http_method',
        'endpoint',
        'status_code',
        'ip_address',
        'user_agent',
        'details',
        'request_context'
      ];

      const rows = response.logs.map((entry) =>
        [
          entry.id,
          entry.timestamp_utc,
          entry.timestamp_cdmx,
          entry.username,
          entry.action,
          entry.resource_type,
          entry.resource_id,
          entry.resource_name,
          entry.http_method,
          entry.endpoint,
          entry.status_code,
          entry.ip_address,
          entry.user_agent,
          entry.details,
          entry.request_context
        ]
          .map((cell) => escapeCsvCell(cell))
          .join(',')
      );

      downloadBlob(`${baseName}.csv`, [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
    } catch (requestError: any) {
      alert(requestError.response?.data?.error || 'No se pudo exportar la auditoría.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="superadmin-audit">
      <div className="superadmin-audit-header">
        <div>
          <h2>Auditoría de Actividad</h2>
          <p>Seguimiento técnico de acciones: usuarios, endpoints, IP, navegador y contexto de petición.</p>
        </div>
        <div className="superadmin-audit-header-actions">
          <button type="button" className="audit-light-button" onClick={loadStats} disabled={loadingStats}>
            {loadingStats ? 'Actualizando métricas...' : 'Actualizar métricas'}
          </button>
          <button type="button" className="audit-light-button" onClick={() => loadLogs()}>
            Recargar registros
          </button>
        </div>
      </div>

      <div className="superadmin-audit-metrics">
        <article className="audit-metric-card">
          <span>Total de logs</span>
          <strong>{stats?.total ?? total}</strong>
        </article>
        <article className="audit-metric-card">
          <span>Acción más frecuente</span>
          <strong>{stats?.topActions[0]?.action ?? '-'}</strong>
        </article>
        <article className="audit-metric-card">
          <span>Usuario más activo</span>
          <strong>{stats?.topUsers[0]?.username ?? '-'}</strong>
        </article>
      </div>

      <div className="superadmin-audit-filters">
        <div className="audit-filter-grid">
          <label>
            Usuario ID
            <input
              type="number"
              min={1}
              value={draftFilters.userId}
              onChange={(event) => handleDraftChange('userId', event.target.value)}
              placeholder="Ej. 2"
            />
          </label>
          <label>
            Acción
            <select value={draftFilters.action} onChange={(event) => handleDraftChange('action', event.target.value)}>
              <option value="">Todas</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label>
            Método HTTP
            <select
              value={draftFilters.httpMethod}
              onChange={(event) => handleDraftChange('httpMethod', event.target.value)}
            >
              <option value="">Todos</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>
          <label>
            Endpoint contiene
            <input
              type="text"
              value={draftFilters.endpoint}
              onChange={(event) => handleDraftChange('endpoint', event.target.value)}
              placeholder="/api/documents"
            />
          </label>
          <label>
            Código de estado
            <input
              type="number"
              min={100}
              max={599}
              value={draftFilters.statusCode}
              onChange={(event) => handleDraftChange('statusCode', event.target.value)}
              placeholder="200"
            />
          </label>
          <label>
            Fecha inicio (UTC)
            <input
              type="date"
              value={draftFilters.startDate}
              onChange={(event) => handleDraftChange('startDate', event.target.value)}
            />
          </label>
          <label>
            Fecha fin (UTC)
            <input type="date" value={draftFilters.endDate} onChange={(event) => handleDraftChange('endDate', event.target.value)} />
          </label>
          <label>
            Registros por página
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number.parseInt(event.target.value, 10));
                setOffset(0);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="audit-filter-actions">
          <button type="button" className="audit-primary-button" onClick={handleApplyFilters} disabled={loadingLogs}>
            Aplicar filtros
          </button>
          <button type="button" className="audit-light-button" onClick={handleClearFilters} disabled={loadingLogs}>
            Limpiar
          </button>
          <button
            type="button"
            className="audit-light-button"
            onClick={() => handleExport('json')}
            disabled={loadingLogs || exporting}
          >
            {exporting ? 'Exportando...' : `Exportar JSON (${EXPORT_LIMIT})`}
          </button>
          <button
            type="button"
            className="audit-light-button"
            onClick={() => handleExport('csv')}
            disabled={loadingLogs || exporting}
          >
            {exporting ? 'Exportando...' : `Exportar CSV (${EXPORT_LIMIT})`}
          </button>
        </div>
      </div>

      {error && <p className="audit-error">{error}</p>}

      <div className="audit-table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Método</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>IP</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loadingLogs ? (
              <tr>
                <td colSpan={8} className="audit-empty">
                  Cargando registros...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="audit-empty">
                  No hay registros con esos filtros.
                </td>
              </tr>
            ) : (
              logs.map((entry) => {
                const expanded = expandedLogId === entry.id;
                const context = parseContext(entry.request_context);
                const statusClass =
                  entry.status_code === null ? 'is-neutral' : entry.status_code >= 400 ? 'is-error' : 'is-ok';
                return (
                  <tr key={entry.id} className={expanded ? 'expanded-row' : ''}>
                    <td>{formatTimestamp(entry.timestamp_utc)}</td>
                    <td>{entry.username}</td>
                    <td>{entry.action}</td>
                    <td>{entry.http_method || '-'}</td>
                    <td>{entry.endpoint || '-'}</td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {entry.status_code || '-'}
                      </span>
                    </td>
                    <td>{entry.ip_address || '-'}</td>
                    <td>
                      <button
                        type="button"
                        className="audit-detail-button"
                        onClick={() => setExpandedLogId((current) => (current === entry.id ? null : entry.id))}
                      >
                        {expanded ? 'Ocultar' : 'Ver'}
                      </button>
                      {expanded && (
                        <div className="audit-detail-panel">
                          <p>
                            <strong>Recurso:</strong> {entry.resource_type || '-'} / {entry.resource_name || '-'} (
                            {entry.resource_id || '-'})
                          </p>
                          <p>
                            <strong>Descripción:</strong> {entry.details || '-'}
                          </p>
                          <p>
                            <strong>User-Agent:</strong> {entry.user_agent || '-'}
                          </p>
                          <p>
                            <strong>Timestamp CDMX:</strong> {entry.timestamp_cdmx || '-'}
                          </p>
                          <p>
                            <strong>Contexto técnico:</strong>
                          </p>
                          <pre>{JSON.stringify(context, null, 2)}</pre>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="audit-pagination">
        <span>
          Página {currentPage} de {totalPages} | {total} registros
        </span>
        <div className="audit-pagination-actions">
          <button
            type="button"
            className="audit-light-button"
            disabled={currentPage <= 1 || loadingLogs}
            onClick={() => setOffset((current) => Math.max(0, current - limit))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="audit-light-button"
            disabled={currentPage >= totalPages || loadingLogs}
            onClick={() => setOffset((current) => current + limit)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
