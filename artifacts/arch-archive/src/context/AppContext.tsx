import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, Document, UserType, DocumentType, Contract } from '../types';
import { mockProjects, mockDocuments, mockContracts as initialContracts } from '../data/mockData';

interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  userType: UserType | null;
  login: (type: UserType) => void;
  logout: () => void;
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  documents: Document[];
  addDocument: (doc: Document) => void;
  deleteDocument: (id: string) => void;
  deleteDocuments: (ids: string[]) => void;
  getNextDocNumber: (type: DocumentType) => string;
  contracts: Contract[];
  addContract: (contract: Contract) => void;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  );
  const [userType, setUserType] = useState<UserType | null>(
    (localStorage.getItem('userType') as UserType) || null
  );

  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  const login = (type: UserType) => {
    setUserType(type);
    localStorage.setItem('userType', type);
  };

  const logout = () => {
    setUserType(null);
    localStorage.removeItem('userType');
  };

  const addProject = (project: Project) => {
    setProjects(prev => [project, ...prev]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
    );
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setDocuments(prev => prev.filter(d => d.projectId !== id));
    setContracts(prev => prev.filter(c => c.projectId !== id));
  };

  const addDocument = (doc: Document) => {
    setDocuments(prev => [doc, ...prev]);
    setProjects(prev =>
      prev.map(p => p.id === doc.projectId ? { ...p, updatedAt: new Date().toISOString() } : p)
    );
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const deleteDocuments = (ids: string[]) => {
    const idSet = new Set(ids);
    setDocuments(prev => prev.filter(d => !idSet.has(d.id)));
  };

  const getNextDocNumber = (type: DocumentType) => {
    const prefixes: Record<DocumentType, string> = {
      contract: 'CON', quotation: 'QUO', employee_data: 'EMP',
      report: 'REP', image: 'PIC', meeting: 'MTG', letter: 'LTR',
      contractor: 'CTR', drawing: 'DRW',
    };
    const prefix = prefixes[type];
    const count = documents.filter(d => d.type === type).length;
    return `${prefix}-${count + 1}`;
  };

  const addContract = (contract: Contract) => {
    setContracts(prev => [contract, ...prev]);
  };

  const updateContract = (id: string, updates: Partial<Contract>) => {
    setContracts(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
    );
  };

  const deleteContract = (id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id));
  };

  return (
    <AppContext.Provider value={{
      theme, toggleTheme, userType, login, logout,
      projects, addProject, updateProject, deleteProject,
      documents, addDocument, deleteDocument, deleteDocuments, getNextDocNumber,
      contracts, addContract, updateContract, deleteContract,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
