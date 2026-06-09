export type UserType = 'manager' | 'entry';

export type ProjectStatus = 'active' | 'completed';

export type DocumentType = 
  | 'contract' 
  | 'quotation' 
  | 'employee_data' 
  | 'report' 
  | 'image' 
  | 'meeting' 
  | 'letter' 
  | 'contractor' 
  | 'drawing';

export interface Project {
  id: string;
  number: string;
  name: string;
  client: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  coverImage: string;
}

export interface Document {
  id: string;
  number: string;
  name: string;
  type: DocumentType;
  projectId: string;
  createdAt: string;
}
