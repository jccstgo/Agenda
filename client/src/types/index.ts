export interface User {
  id: number;
  username: string;
  role: 'superadmin' | 'admin' | 'reader';
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Tab {
  id: number;
  name: string;
  order_index: number;
}

export interface TabUpdateInput {
  id: number;
  name: string;
}

export interface Document {
  id: number;
  tab_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: number;
  created_at: string;
}

export interface SuperadminAuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  resource_name: string | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  http_method: string | null;
  endpoint: string | null;
  status_code: number | null;
  request_context: string | null;
  timestamp_utc: string;
  timestamp_cdmx: string | null;
}

export interface SuperadminAuditLogsQuery {
  userId?: number;
  action?: string;
  httpMethod?: string;
  endpoint?: string;
  statusCode?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SuperadminAuditLogsResponse {
  logs: SuperadminAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface SuperadminAuditStatsResponse {
  total: number;
  topActions: Array<{
    action: string;
    count: number;
  }>;
  topUsers: Array<{
    user_id: number;
    username: string;
    role: 'superadmin' | 'admin' | 'reader' | null;
    actions_count: number;
  }>;
  dailyActivity: Array<{
    date: string;
    count: number;
  }>;
}
