import axios from 'axios';
import type { LoginResponse, Tab, Document, TabUpdateInput } from '../types';

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

export const uploadDocument = async (tabId: number, file: File): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<Document>(`/documents/${tabId}`, formData, {
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
