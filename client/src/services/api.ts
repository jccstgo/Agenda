import axios from 'axios';
import type {
  LoginResponse,
  Tab,
  Document,
  TabUpdateInput,
  SuperadminAuditLogsResponse,
  SuperadminAuditLogsQuery,
  SuperadminAuditStatsResponse,
  SuperadminTabAssignmentsResponse,
  SuperadminManagedUser
} from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', { username, password });
  return response.data;
};

export const verifyToken = async (): Promise<boolean> => {
  try {
    await api.get('/auth/verify');
    return true;
  } catch {
    return false;
  }
};

export interface ChangeOwnPasswordResponse {
  success: boolean;
  message: string;
}

export const changeOwnPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<ChangeOwnPasswordResponse> => {
  const response = await api.post<ChangeOwnPasswordResponse>('/auth/change-password', {
    currentPassword,
    newPassword
  });
  return response.data;
};

export interface ResetDefaultPasswordsResponse {
  success: boolean;
  message: string;
  users: Array<{
    id: number;
    username: string;
    role: 'superadmin' | 'admin' | 'reader';
  }>;
}

export const resetDefaultPasswordsAsSuperadmin = async (): Promise<ResetDefaultPasswordsResponse> => {
  const response = await api.post<ResetDefaultPasswordsResponse>('/superadmin/users/reset-default-passwords', {
    confirmation: 'RESET_DEFAULT_PASSWORDS_SUPERADMIN'
  });
  return response.data;
};

export const getSuperadminAuditLogs = async (
  query: SuperadminAuditLogsQuery = {}
): Promise<SuperadminAuditLogsResponse> => {
  const response = await api.get<SuperadminAuditLogsResponse>('/superadmin/audit-logs', { params: query });
  return response.data;
};

export const getSuperadminAuditStats = async (): Promise<SuperadminAuditStatsResponse> => {
  const response = await api.get<SuperadminAuditStatsResponse>('/superadmin/audit-logs/stats');
  return response.data;
};

export const getSuperadminTabAssignments = async (): Promise<SuperadminTabAssignmentsResponse> => {
  const response = await api.get<SuperadminTabAssignmentsResponse>('/superadmin/tab-assignments');
  return response.data;
};

export const updateSuperadminTabAssignments = async (
  assignments: Array<{ tabId: number; userIds: number[] }>
): Promise<SuperadminTabAssignmentsResponse> => {
  const response = await api.put<SuperadminTabAssignmentsResponse>('/superadmin/tab-assignments', {
    assignments
  });
  return response.data;
};

export interface CreateSuperadminUserResponse {
  success: boolean;
  message: string;
  user: {
    id: number;
    username: string;
    role: 'admin' | 'reader';
  };
}

export interface SuperadminUsersResponse {
  users: SuperadminManagedUser[];
}

export const createSuperadminUser = async (
  payload: { username: string; password: string; role?: 'admin' | 'reader' }
): Promise<CreateSuperadminUserResponse> => {
  const response = await api.post<CreateSuperadminUserResponse>('/superadmin/users', {
    username: payload.username,
    password: payload.password,
    role: payload.role || 'admin'
  });
  return response.data;
};

export const getSuperadminUsers = async (): Promise<SuperadminUsersResponse> => {
  const response = await api.get<SuperadminUsersResponse>('/superadmin/users');
  return response.data;
};

export interface UpdateSuperadminUserResponse {
  success: boolean;
  message: string;
}

export const updateSuperadminUsername = async (
  userId: number,
  username: string
): Promise<UpdateSuperadminUserResponse> => {
  const response = await api.put<UpdateSuperadminUserResponse>(`/superadmin/users/${userId}`, {
    username
  });
  return response.data;
};

export const changeSuperadminUserPassword = async (
  userId: number,
  newPassword: string
): Promise<UpdateSuperadminUserResponse> => {
  const response = await api.post<UpdateSuperadminUserResponse>(`/superadmin/users/${userId}/change-password`, {
    newPassword
  });
  return response.data;
};

export const changeSuperadminUserRole = async (
  userId: number,
  newRole: 'admin' | 'reader'
): Promise<UpdateSuperadminUserResponse> => {
  const response = await api.post<UpdateSuperadminUserResponse>(`/superadmin/users/${userId}/change-role`, {
    newRole
  });
  return response.data;
};

export const deleteSuperadminUser = async (userId: number): Promise<UpdateSuperadminUserResponse> => {
  const response = await api.delete<UpdateSuperadminUserResponse>(`/superadmin/users/${userId}`);
  return response.data;
};

// Tabs
export const getTabs = async (): Promise<Tab[]> => {
  const response = await api.get<Tab[]>('/tabs');
  return response.data;
};

export const createTab = async (name: string): Promise<Tab> => {
  const response = await api.post<Tab>('/tabs', { name });
  return response.data;
};

export const updateTabs = async (tabs: TabUpdateInput[]): Promise<Tab[]> => {
  const response = await api.put<Tab[]>('/tabs', { tabs });
  return response.data;
};

export const deleteTab = async (tabId: number): Promise<Tab[]> => {
  const response = await api.delete<Tab[]>(`/tabs/${tabId}`);
  return response.data;
};

// Documents
export const getDocuments = async (tabId: number): Promise<Document[]> => {
  const response = await api.get<Document[]>(`/documents/${tabId}`);
  return response.data;
};

export const uploadDocuments = async (tabId: number, files: File[]): Promise<Document[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await api.post<Document[]>(`/documents/${tabId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteDocument = async (documentId: number): Promise<void> => {
  await api.delete(`/documents/${documentId}`);
};

export const getDocumentUrl = (filename: string, tabId: number): string => {
  const token = localStorage.getItem('token');
  return `${API_URL}/documents/file/${filename}?tabId=${tabId}&token=${token}`;
};
