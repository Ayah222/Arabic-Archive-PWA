import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { DocumentType } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search } from 'lucide-react';

export default function Documents() {
  const { documents, projects } = useAppContext();
  const [, setLocation] = useLocation();
  
  const searchParams = new URLSearchParams(window.location.search);
  const initialProjectId = searchParams.get('project') || 'all';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredDocs = documents
    .filter(d => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (projectFilter !== 'all' && d.projectId !== projectFilter) return false;
      if (search && !d.name.includes(search) && !d.number.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const docTypeLabels: Record<string, string> = {
    contract: 'عقد', quotation: 'عرض سعر', employee_data: 'بيانات موظف',
    report: 'تقرير', image: 'صورة', meeting: 'اجتماع', letter: 'خطاب',
    contractor: 'مقاول', drawing: 'مخطط'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">المستندات</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="البحث برقم المستند أو اسمه..." 
                className="pr-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex gap-4">
              <select 
                className="h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background md:w-48"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as DocumentType | 'all')}
              >
                <option value="all">كل الأنواع</option>
                {Object.entries(docTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              <select 
                className="h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background md:w-48 max-w-[200px]"
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
              >
                <option value="all">كل المشاريع</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select 
                className="h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">رقم المستند</TableHead>
              <TableHead className="text-right">اسم المستند</TableHead>
              <TableHead className="text-right">المشروع</TableHead>
              <TableHead className="text-right">النوع</TableHead>
              <TableHead className="text-right">تاريخ الإضافة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  لا توجد مستندات تطابق معايير البحث
                </TableCell>
              </TableRow>
            ) : (
              filteredDocs.map(doc => {
                const project = projects.find(p => p.id === doc.projectId);
                return (
                  <TableRow key={doc.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{doc.number}</TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{doc.name}</TableCell>
                    <TableCell>
                      <button 
                        className="text-primary hover:underline max-w-[200px] truncate text-right block"
                        onClick={() => setLocation(`/projects/${doc.projectId}`)}
                      >
                        {project?.name || 'مشروع غير معروف'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted">
                        {docTypeLabels[doc.type] || doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
