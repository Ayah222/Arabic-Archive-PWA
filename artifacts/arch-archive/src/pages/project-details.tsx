import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  ArrowRight, FileSignature, Receipt, Users, BarChart2,
  Image as ImageIcon, Calendar, Mail, HardHat, Ruler,
  Pencil, Trash2, MapPin, Building2, Plus, LayoutGrid,
  List, Table2, Download, Eye, FileText, Clock,
} from 'lucide-react';
import { Document, DocumentType, PROJECT_TYPES } from '../types';
import {
  getPreviewType, getThumbnailUrl, previewTypeColors, docTypeLabels,
} from '../lib/docUtils';
import EditProjectDialog from '../components/projects/EditProjectDialog';
import AddDocumentsDialog from '../components/documents/AddDocumentsDialog';
import DocumentPreviewModal from '../components/documents/DocumentPreviewModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface ProjectDetailsProps { id: string; }

type ViewMode = 'grid' | 'list' | 'table';

/* ─────────────────────────────────────── */
/* Shared thumbnail component              */
/* ─────────────────────────────────────── */
function DocThumb({ doc, size = 'md' }: { doc: Document; size?: 'sm' | 'md' | 'lg' }) {
  const pt = getPreviewType(doc.type);
  const thumb = getThumbnailUrl(doc.id, doc.type);
  const col = previewTypeColors[pt];
  const dim = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-full h-48' : 'w-full h-36';
  const iconSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-2xl' : 'text-base';

  if (pt === 'image' && thumb) {
    return (
      <div className={`${dim} overflow-hidden bg-muted rounded-lg shrink-0`}>
        <img src={thumb} alt={doc.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${dim} bg-gradient-to-br ${col.bg} rounded-lg flex flex-col items-center justify-center gap-1 shrink-0`}>
      <span className={`font-bold text-white/90 font-mono ${iconSize}`}>{col.ext}</span>
      {size !== 'sm' && <span className="text-white/60 text-xs">{col.label}</span>}
    </div>
  );
}

/* ─────────────────────────────────────── */
/* Inline preview panel (split view)       */
/* ─────────────────────────────────────── */
function InlinePreview({ doc }: { doc: Document | null }) {
  if (!doc) {
    return (
      <div className="flex-1 rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-3 min-h-80">
        <Eye className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">اختر مستنداً للمعاينة</p>
      </div>
    );
  }
  const pt = getPreviewType(doc.type);
  const thumb = getThumbnailUrl(doc.id, doc.type);
  const col = previewTypeColors[pt];
  const typeLabel = docTypeLabels[doc.type];

  return (
    <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-80">
      {/* Preview area */}
      <div className="flex-1 bg-muted/30 flex items-center justify-center p-4">
        {pt === 'image' && thumb ? (
          <img src={thumb} alt={doc.name} className="max-h-72 max-w-full rounded-lg object-contain shadow-md" />
        ) : (
          <div className={`w-full max-w-xs rounded-xl bg-gradient-to-br ${col.bg} py-10 flex flex-col items-center justify-center gap-3`}>
            <span className="text-4xl font-bold text-white/80 font-mono">{col.ext}</span>
            <span className="text-white/60 text-sm px-4 text-center">{doc.name}</span>
          </div>
        )}
      </div>
      {/* Meta */}
      <div className="p-4 border-t border-border space-y-3">
        <p className="font-semibold text-sm truncate" title={doc.name}>{doc.name}</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">الرقم</p>
            <p className="font-mono font-bold text-primary">{doc.number}</p>
          </div>
          <div>
            <p className="text-muted-foreground">النوع</p>
            <Badge variant="outline" className="text-xs mt-0.5">{typeLabel}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">التاريخ</p>
            <p className="font-medium">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</p>
          </div>
        </div>
        <Button size="sm" className="w-full gap-2" onClick={() => alert('تحميل المستند (محاكاة)')}>
          <Download className="w-3.5 h-3.5" />
          تحميل
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/* Main page component                     */
/* ─────────────────────────────────────── */
export default function ProjectDetails({ id }: ProjectDetailsProps) {
  const { projects, documents, deleteProject } = useAppContext();
  const [, setLocation] = useLocation();

  const [selectedCategory, setSelectedCategory] = useState<DocumentType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addDocsOpen, setAddDocsOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [splitPreviewDoc, setSplitPreviewDoc] = useState<Document | null>(null);

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

  const projectDocs = useMemo(
    () => documents.filter(d => d.projectId === id),
    [documents, id],
  );

  const filteredDocs = useMemo(() => {
    const base = selectedCategory === 'all' ? projectDocs : projectDocs.filter(d => d.type === selectedCategory);
    return base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [projectDocs, selectedCategory]);

  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projectDocs.forEach(d => { counts[d.type] = (counts[d.type] || 0) + 1; });
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

  const handleDelete = () => { deleteProject(id); setLocation('/projects'); };

  const handleCategoryClick = (type: DocumentType) => {
    if (type === selectedCategory) {
      setSelectedCategory('all');
      setSplitPreviewDoc(null);
    } else {
      setSelectedCategory(type);
      setSplitPreviewDoc(null);
    }
  };

  const isSplitView = selectedCategory !== 'all';
  const sectionTitle = selectedCategory === 'all'
    ? 'جميع مستندات المشروع'
    : `مستندات: ${categories.find(c => c.type === selectedCategory)?.label}`;

  /* ─── View Mode rendering helpers ─── */
  const renderGridDoc = (doc: Document) => (
    <Card
      key={doc.id}
      className="overflow-hidden cursor-pointer hover:border-primary hover:shadow-md transition-all group"
      onClick={() => isSplitView ? setSplitPreviewDoc(doc) : setPreviewDoc(doc)}
      data-testid={`doc-card-${doc.id}`}
    >
      <DocThumb doc={doc} size="lg" />
      <CardContent className="p-3">
        <p className="font-mono text-xs text-primary font-bold mb-1">{doc.number}</p>
        <p className="text-xs font-medium leading-tight truncate mb-2" title={doc.name}>{doc.name}</p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">{docTypeLabels[doc.type]}</Badge>
          <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderListDoc = (doc: Document) => (
    <div
      key={doc.id}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary cursor-pointer transition-all"
      onClick={() => isSplitView ? setSplitPreviewDoc(doc) : setPreviewDoc(doc)}
      data-testid={`doc-list-${doc.id}`}
    >
      <DocThumb doc={doc} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-xs text-primary">{doc.number}</span>
          <Badge variant="outline" className="text-xs h-4">{docTypeLabels[doc.type]}</Badge>
        </div>
      </div>
      <div className="text-left shrink-0">
        <p className="text-xs text-muted-foreground whitespace-nowrap">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</p>
      </div>
    </div>
  );

  const renderTableDocs = () => (
    <Table>
      <TableHeader>
        <TableRow className="border-b-2 border-border bg-muted/60">
          <TableHead className="text-right font-bold text-foreground py-3 px-4 w-16">معاينة</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">رقم المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">اسم المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">نوع المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">تاريخ الإضافة</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4 w-20">الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDocs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد مستندات</TableCell>
          </TableRow>
        ) : filteredDocs.map((doc, i) => (
          <TableRow
            key={doc.id}
            className={`border-b border-border hover:bg-muted/40 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
            onClick={() => isSplitView ? setSplitPreviewDoc(doc) : setPreviewDoc(doc)}
          >
            <TableCell className="py-2 px-4">
              <DocThumb doc={doc} size="sm" />
            </TableCell>
            <TableCell className="font-mono text-sm font-bold text-primary py-3 px-4">{doc.number}</TableCell>
            <TableCell className="font-medium max-w-[240px] truncate py-3 px-4">{doc.name}</TableCell>
            <TableCell className="py-3 px-4">
              <Badge variant="outline" className="bg-muted text-xs">{docTypeLabels[doc.type]}</Badge>
            </TableCell>
            <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap text-sm">
              {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
            </TableCell>
            <TableCell className="py-3 px-4">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={e => { e.stopPropagation(); setPreviewDoc(doc); }}
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  /* ─── Documents content area ─── */
  const renderDocsContent = () => {
    if (filteredDocs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <FileText className="w-12 h-12 opacity-30" />
          <p className="font-medium">لا توجد مستندات في هذا القسم</p>
          <Button variant="outline" size="sm" className="gap-2 mt-2" onClick={() => setAddDocsOpen(true)}>
            <Plus className="w-4 h-4" /> إضافة مستندات
          </Button>
        </div>
      );
    }

    if (isSplitView) {
      return (
        <div className="flex gap-4">
          {/* List panel (right in RTL) */}
          <div className="w-72 shrink-0 space-y-2 max-h-[520px] overflow-y-auto pl-2">
            {filteredDocs.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${splitPreviewDoc?.id === doc.id ? 'border-primary bg-primary/8 ring-1 ring-primary/30' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
                onClick={() => setSplitPreviewDoc(doc)}
              >
                <DocThumb doc={doc} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{doc.name}</p>
                  <p className="font-mono text-xs text-primary">{doc.number}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Preview panel (left in RTL) */}
          <InlinePreview doc={splitPreviewDoc} />
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredDocs.map(renderGridDoc)}
        </div>
      );
    }
    if (viewMode === 'list') {
      return <div className="space-y-2">{filteredDocs.map(renderListDoc)}</div>;
    }
    return <div className="overflow-auto">{renderTableDocs()}</div>;
  };

  /* ─── Render ─── */
  return (
    <div className="space-y-6">

      {/* ── Top action bar ── */}
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
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2" data-testid="button-edit-project">
            <Pencil className="w-4 h-4" />
            تعديل
          </Button>
          <Button onClick={() => setAddDocsOpen(true)} size="sm" className="gap-2" data-testid="button-add-documents">
            <Plus className="w-4 h-4" />
            إضافة مستندات
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-2" data-testid="button-delete-project">
            <Trash2 className="w-4 h-4" />
            حذف
          </Button>
        </div>
      </div>

      {/* ── Banner with full info overlay ── */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-xl" style={{ height: '420px' }}>
        <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />

        {/* Multi-layer gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

        {/* Top-left badge strip */}
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <Badge className={`text-sm px-3 py-1 font-semibold shadow-lg ${project.status === 'active' ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white' : 'bg-blue-500/90 hover:bg-blue-600 text-white'}`}>
            {project.status === 'active' ? '● نشط' : '✓ مكتمل'}
          </Badge>
          <span className="font-mono text-xs text-white/70 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">{project.number}</span>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 inset-x-0 p-6 space-y-4">
          {/* Project name */}
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg">
            {project.name}
          </h1>

          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-white/50 text-xs mb-0.5">العميل</p>
              <p className="text-white font-semibold text-sm truncate">{project.client}</p>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex gap-2">
              <MapPin className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-white/50 text-xs mb-0.5">المدينة</p>
                <p className="text-white font-semibold text-sm truncate">{project.city}</p>
              </div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex gap-2">
              <Building2 className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-white/50 text-xs mb-0.5">نوع المشروع</p>
                <p className="text-white font-semibold text-sm truncate">{PROJECT_TYPES[project.projectType]}</p>
              </div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-white/40" />
                <p className="text-white/50 text-xs">تاريخ الإنشاء</p>
              </div>
              <p className="text-white font-medium text-xs">{new Date(project.createdAt).toLocaleDateString('ar-SA')}</p>
              <p className="text-white/50 text-xs mt-1.5">آخر تحديث</p>
              <p className="text-white font-medium text-xs">{new Date(project.updatedAt).toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">أقسام المستندات</h2>
          {selectedCategory !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory('all'); setSplitPreviewDoc(null); }}>
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
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : ''}`}
                onClick={() => handleCategoryClick(cat.type)}
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

      {/* ── Documents Section ── */}
      <Card>
        {/* Section toolbar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{sectionTitle}</h2>
            <Badge variant="secondary" className="font-mono text-xs">{filteredDocs.length}</Badge>
          </div>

          {/* Controls — hide view mode buttons when in split view */}
          <div className="flex items-center gap-2">
            {!isSplitView && (
              <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
                {([['grid', LayoutGrid], ['list', List], ['table', Table2]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    data-testid={`viewmode-${mode}`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setAddDocsOpen(true)}>
              <Plus className="w-4 h-4" />
              إضافة
            </Button>
          </div>
        </div>

        {/* Documents content */}
        <div className="p-4">
          {renderDocsContent()}
        </div>
      </Card>

      {/* ── Dialogs ── */}
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <AddDocumentsDialog open={addDocsOpen} onOpenChange={setAddDocsOpen} projectId={id} />
      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف المشروع؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف مشروع "<span className="font-semibold text-foreground">{project.name}</span>" وجميع مستنداته ({projectDocs.length} مستند) بشكل نهائي.
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
