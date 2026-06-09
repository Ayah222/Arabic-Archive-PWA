import React, { useMemo, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  ArrowRight, FileSignature, Receipt, Users, BarChart2, 
  Image as ImageIcon, Calendar, Mail, HardHat, Ruler, FileText 
} from 'lucide-react';
import { DocumentType } from '../types';

interface ProjectDetailsProps {
  id: string;
}

export default function ProjectDetails({ id }: ProjectDetailsProps) {
  const { projects, documents } = useAppContext();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<DocumentType | 'all'>('all');

  const project = projects.find(p => p.id === id);

  const categories: { type: DocumentType, label: string, icon: any }[] = [
    { type: 'contract', label: 'العقود', icon: FileSignature },
    { type: 'quotation', label: 'العروض السعرية', icon: Receipt },
    { type: 'employee_data', label: 'بيانات الموظفين', icon: Users },
    { type: 'report', label: 'التقارير', icon: BarChart2 },
    { type: 'image', label: 'الصور', icon: ImageIcon },
    { type: 'meeting', label: 'الاجتماعات', icon: Calendar },
    { type: 'letter', label: 'الخطابات', icon: Mail },
    { type: 'contractor', label: 'المقاولون', icon: HardHat },
    { type: 'drawing', label: 'المخططات', icon: Ruler },
  ];

  const projectDocs = useMemo(() => documents.filter(d => d.projectId === id), [documents, id]);
  
  const filteredDocs = useMemo(() => {
    let docs = projectDocs;
    if (selectedCategory !== 'all') docs = docs.filter(d => d.type === selectedCategory);
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [projectDocs, selectedCategory]);

  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projectDocs.forEach(d => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
    return counts;
  }, [projectDocs]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-2xl font-bold">المشروع غير موجود</h2>
        <Button onClick={() => setLocation('/projects')}>العودة للمشاريع</Button>
      </div>
    );
  }

  const docTypeLabels: Record<string, string> = categories.reduce((acc, cat) => {
    acc[cat.type] = cat.label;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setLocation('/projects')} className="gap-2 pr-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" />
        العودة للمشاريع
      </Button>

      {/* Banner */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden shadow-sm">
        <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6 flex flex-col justify-end">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={project.status === 'active' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}>
                  {project.status === 'active' ? 'نشط' : 'مكتمل'}
                </Badge>
                <span className="font-mono text-sm opacity-80">{project.number}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{project.name}</h1>
              <p className="text-lg opacity-90">العميل: {project.client}</p>
            </div>
            <div className="text-sm opacity-80">
              تاريخ الإنشاء: {new Date(project.createdAt).toLocaleDateString('ar-SA')}
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">أقسام المستندات</h2>
          {selectedCategory !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedCategory('all')}>
              عرض كل المستندات
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map(cat => {
            const count = docCounts[cat.type] || 0;
            const isSelected = selectedCategory === cat.type;
            
            return (
              <Card 
                key={cat.type} 
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedCategory(cat.type)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 h-32">
                  <div className={`p-3 rounded-full ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{cat.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{count} مستند</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Documents Table */}
      <Card>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {selectedCategory === 'all' ? 'أحدث المستندات' : `مستندات: ${docTypeLabels[selectedCategory]}`}
          </h2>
          <Button variant="outline" size="sm" onClick={() => setLocation(`/documents?project=${project.id}`)} className="gap-2">
            <FileText className="w-4 h-4" />
            تصفح الكل
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">رقم المستند</TableHead>
              <TableHead className="text-right">اسم المستند</TableHead>
              <TableHead className="text-right">نوع المستند</TableHead>
              <TableHead className="text-right">تاريخ الإضافة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  لا توجد مستندات في هذا القسم
                </TableCell>
              </TableRow>
            ) : (
              filteredDocs.slice(0, 10).map(doc => (
                <TableRow key={doc.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{doc.number}</TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">{doc.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted">
                      {docTypeLabels[doc.type] || doc.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
