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
