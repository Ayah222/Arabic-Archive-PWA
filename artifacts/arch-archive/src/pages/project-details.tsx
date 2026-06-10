import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  ArrowRight, FileSignature, Receipt, Users, BarChart2,
  Image as ImageIcon, Calendar, Mail, HardHat, Ruler, FileText,
  Pencil, Trash2, MapPin, Building2,
} from 'lucide-react';
import { DocumentType, PROJECT_TYPES } from '../types';
import EditProjectDialog from '../components/projects/EditProjectDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface ProjectDetailsProps {
  id: string;
}

export default function ProjectDetails({ id }: ProjectDetailsProps) {
  const { projects, documents, deleteProject } = useAppContext();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<DocumentType | 'all'>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const project = projects.find(p => p.id === id);

  const categories: { type: DocumentType; label: string; icon: React.ElementType }[] = [
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

  const handleDelete = () => {
    deleteProject(id);
    setLocation('/projects');
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setLocation('/projects')}
          className="gap-2 pr-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
          data-testid="button-back-projects"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للمشاريع
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-2"
            data-testid="button-edit-project"
          >
            <Pencil className="w-4 h-4" />
            تعديل
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-2"
            data-testid="button-delete-project"
          >
            <Trash2 className="w-4 h-4" />
            حذف
          </Button>
        </div>
      </div>

      {/* Banner */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden shadow-md">
        <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 flex flex-col justify-end">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={project.status === 'active' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}>
                {project.status === 'active' ? 'نشط' : 'مكتمل'}
              </Badge>
              <span className="font-mono text-sm text-white/80">{project.number}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">{project.name}</h1>
          </div>
        </div>
      </div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">العميل</p>
            <p className="font-semibold text-sm">{project.client}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">المدينة</p>
              <p className="font-semibold text-sm">{project.city}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">نوع المشروع</p>
              <p className="font-semibold text-sm">{PROJECT_TYPES[project.projectType]}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">تاريخ الإنشاء</p>
            <p className="font-semibold text-sm">{new Date(project.createdAt).toLocaleDateString('ar-SA')}</p>
            <p className="text-xs text-muted-foreground mt-2">آخر تحديث</p>
            <p className="font-semibold text-sm">{new Date(project.updatedAt).toLocaleDateString('ar-SA')}</p>
          </CardContent>
        </Card>
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
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          {categories.map(cat => {
            const count = docCounts[cat.type] || 0;
            const isSelected = selectedCategory === cat.type;
            return (
              <Card
                key={cat.type}
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedCategory(cat.type === selectedCategory ? 'all' : cat.type)}
                data-testid={`card-category-${cat.type}`}
              >
                <CardContent className="p-3 flex flex-col items-center justify-center text-center gap-2 h-28">
                  <div className={`p-2.5 rounded-full ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs leading-tight">{cat.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{count} مستند</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Documents Table */}
      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {selectedCategory === 'all' ? 'أحدث المستندات' : `مستندات: ${docTypeLabels[selectedCategory]}`}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/documents?project=${project.id}`)}
            className="gap-2"
            data-testid="button-view-all-documents"
          >
            <FileText className="w-4 h-4" />
            عرض جميع المستندات
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border bg-muted/60">
                <TableHead className="text-right font-bold text-foreground py-3 px-4">رقم المستند</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">اسم المستند</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">نوع المستند</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">تاريخ الإضافة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    لا توجد مستندات في هذا القسم
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc, i) => (
                  <TableRow
                    key={doc.id}
                    className={`border-b border-border hover:bg-muted/50 transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                  >
                    <TableCell className="font-mono text-sm font-semibold text-primary py-3 px-4">{doc.number}</TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate py-3 px-4">{doc.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="outline" className="bg-muted text-xs">
                        {docTypeLabels[doc.type] || doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف المشروع؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف مشروع "<span className="font-semibold text-foreground">{project.name}</span>" وجميع مستنداته ({projectDocs.length} مستند) بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              حذف المشروع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
