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
  Pencil, Trash2, MapPin, Building2, Plus,
  List, LayoutGrid, Download, Eye, FileText, Clock, CheckSquare,
} from 'lucide-react';
import { Document, DocumentType, PROJECT_TYPES } from '../types';
import { getPreviewType, getThumbnailUrl, previewTypeColors, docTypeLabels } from '../lib/docUtils';
import EditProjectDialog from '../components/projects/EditProjectDialog';
import AddDocumentsDialog from '../components/documents/AddDocumentsDialog';
import DocumentPreviewModal from '../components/documents/DocumentPreviewModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface ProjectDetailsProps { id: string; }
type ViewMode = 'grid' | 'list';

/* ── Shared thumbnail ── */
function DocThumb({ doc, size = 'md' }: { doc: Document; size?: 'sm' | 'md' | 'lg' }) {
  const pt = getPreviewType(doc.type);
  const thumb = getThumbnailUrl(doc.id, doc.type);
  const col = previewTypeColors[pt];
  const dim = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-full h-40' : 'w-full h-32';
  const iconSize = size === 'sm' ? 'text-xs' : 'text-base';

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

/* ── Inline split-view preview panel ── */
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
  return (
    <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-80">
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
      <div className="p-4 border-t border-border space-y-3">
        <p className="font-semibold text-sm truncate">{doc.name}</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">الرقم</p>
            <p className="font-mono font-bold text-primary">{doc.number}</p>
          </div>
          <div>
            <p className="text-muted-foreground">النوع</p>
            <Badge variant="outline" className="text-xs mt-0.5">{docTypeLabels[doc.type]}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">التاريخ</p>
            <p className="font-medium">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</p>
          </div>
        </div>
        <Button size="sm" className="w-full gap-2" onClick={() => alert('تحميل المستند (محاكاة)')}>
          <Download className="w-3.5 h-3.5" />تحميل
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════ */
export default function ProjectDetails({ id }: ProjectDetailsProps) {
  const { projects, documents, deleteProject, deleteDocument, deleteDocuments } = useAppContext();
  const [, setLocation] = useLocation();

  const [selectedCategory, setSelectedCategory] = useState<DocumentType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addDocsOpen, setAddDocsOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [splitPreviewDoc, setSplitPreviewDoc] = useState<Document | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteDoc, setSingleDeleteDoc] = useState<Document | null>(null);

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
    if (type === selectedCategory) { setSelectedCategory('all'); setSplitPreviewDoc(null); }
    else { setSelectedCategory(type); setSplitPreviewDoc(null); setSelectedDocs(new Set()); }
  };

  /* ── Selection helpers ── */
  const toggleSelect = (docId: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const isAllSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedDocs.has(d.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocs.map(d => d.id)));
    }
  };

  const handleBulkDelete = () => {
    deleteDocuments(Array.from(selectedDocs));
    setSelectedDocs(new Set());
    setSplitPreviewDoc(null);
    setBulkDeleteOpen(false);
  };

  const handleSingleDelete = (doc: Document) => {
    setSingleDeleteDoc(doc);
  };

  const confirmSingleDelete = () => {
    if (singleDeleteDoc) {
      deleteDocument(singleDeleteDoc.id);
      if (splitPreviewDoc?.id === singleDeleteDoc.id) setSplitPreviewDoc(null);
      if (previewDoc?.id === singleDeleteDoc.id) setPreviewDoc(null);
      setSelectedDocs(prev => { const n = new Set(prev); n.delete(singleDeleteDoc.id); return n; });
      setSingleDeleteDoc(null);
    }
  };

  const isSplitView = selectedCategory !== 'all';
  const sectionTitle = selectedCategory === 'all'
    ? 'جميع مستندات المشروع'
    : `مستندات: ${categories.find(c => c.type === selectedCategory)?.label}`;

  /* ── Checkbox element ── */
  const Checkbox = ({ checked, onChange, onClick }: { checked: boolean; onChange: () => void; onClick?: (e: React.MouseEvent) => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={onClick}
      className="w-4 h-4 rounded border-border cursor-pointer accent-primary shrink-0"
    />
  );

  /* ── Grid card (gallery style – 70% preview / 30% info) ── */
  const renderGridDoc = (doc: Document) => {
    const isSelected = selectedDocs.has(doc.id);
    const pt = getPreviewType(doc.type);
    const thumb = getThumbnailUrl(doc.id, doc.type);
    const col = previewTypeColors[pt];

    return (
      <div
        key={doc.id}
        className={`relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 group
          ${isSelected
            ? 'border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10 bg-card'
            : 'border-border bg-card hover:border-primary/70 hover:shadow-xl hover:-translate-y-1'}`}
        onClick={() => setPreviewDoc(doc)}
        data-testid={`doc-card-${doc.id}`}
      >
        {/* Selection zone – top right, large hit area, always visible */}
        <div
          className="absolute top-0 right-0 z-20 w-11 h-11 flex items-start justify-end p-2.5 cursor-pointer"
          onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}
        >
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 shadow-sm
            ${isSelected
              ? 'bg-primary border-primary'
              : 'bg-white/80 border-white/70 backdrop-blur-sm hover:border-primary/80 hover:bg-white'}`}>
            {isSelected && (
              <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>

        {/* Delete button – top left, on hover */}
        <div
          className="absolute top-2.5 left-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          onClick={e => { e.stopPropagation(); handleSingleDelete(doc); }}
        >
          <button className="w-7 h-7 rounded-lg bg-destructive/90 backdrop-blur-sm text-white flex items-center justify-center hover:bg-destructive shadow-md transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Preview area (70% of card) ── */}
        <div className="h-44 overflow-hidden relative">
          {pt === 'image' && thumb ? (
            <img
              src={thumb}
              alt={doc.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${col.bg} flex flex-col items-center justify-center gap-2 select-none`}>
              <span className="text-5xl font-black text-white/80 font-mono tracking-tighter leading-none">{col.ext}</span>
              <span className="text-sm text-white/55 font-medium">{col.label}</span>
            </div>
          )}
          {/* subtle bottom gradient for depth */}
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
        </div>

        {/* ── Info area (30% of card) ── */}
        <div className="p-3 space-y-1.5">
          <p className="font-mono text-xs font-bold text-primary">{doc.number}</p>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-xs shrink-0">{docTypeLabels[doc.type]}</Badge>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* ── List item ── */
  const renderListDoc = (doc: Document) => {
    const isSelected = selectedDocs.has(doc.id);
    return (
      <div
        key={doc.id}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary'}`}
        data-testid={`doc-list-${doc.id}`}
      >
        <div onClick={e => e.stopPropagation()}>
          <Checkbox checked={isSelected} onChange={() => toggleSelect(doc.id)} />
        </div>
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => isSplitView ? setSplitPreviewDoc(doc) : setPreviewDoc(doc)}
        >
          <DocThumb doc={doc} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{doc.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs text-primary">{doc.number}</span>
              <Badge variant="outline" className="text-xs h-4">{docTypeLabels[doc.type]}</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); handleSingleDelete(doc); }}
          className="shrink-0 w-7 h-7 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
          title="حذف المستند"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  /* ── Table ── */
  const renderTableDocs = () => (
    <Table>
      <TableHeader>
        <TableRow className="border-b-2 border-border bg-muted/60">
          <TableHead className="text-right py-3 px-3 w-10">
            <Checkbox checked={isAllSelected} onChange={toggleSelectAll} />
          </TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-3 w-14">معاينة</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">رقم المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">اسم المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">نوع المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">تاريخ الإضافة</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-3 w-20">الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDocs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد مستندات</TableCell>
          </TableRow>
        ) : filteredDocs.map((doc, i) => {
          const isSelected = selectedDocs.has(doc.id);
          return (
            <TableRow
              key={doc.id}
              className={`border-b border-border transition-colors ${isSelected ? 'bg-primary/5' : i % 2 === 0 ? 'bg-background hover:bg-muted/40' : 'bg-muted/10 hover:bg-muted/40'}`}
            >
              <TableCell className="py-2 px-3" onClick={e => e.stopPropagation()}>
                <Checkbox checked={isSelected} onChange={() => toggleSelect(doc.id)} />
              </TableCell>
              <TableCell className="py-2 px-3">
                <div
                  className="cursor-pointer"
                  onClick={() => isSplitView ? setSplitPreviewDoc(doc) : setPreviewDoc(doc)}
                >
                  <DocThumb doc={doc} size="sm" />
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm font-bold text-primary py-3 px-4 cursor-pointer" onClick={() => setPreviewDoc(doc)}>{doc.number}</TableCell>
              <TableCell className="font-medium max-w-[220px] truncate py-3 px-4 cursor-pointer" onClick={() => setPreviewDoc(doc)}>{doc.name}</TableCell>
              <TableCell className="py-3 px-4">
                <Badge variant="outline" className="bg-muted text-xs">{docTypeLabels[doc.type]}</Badge>
              </TableCell>
              <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap text-sm">
                {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
              </TableCell>
              <TableCell className="py-3 px-3">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewDoc(doc)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleSingleDelete(doc)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  /* ── Documents content ── */
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
          <div className="w-72 shrink-0 space-y-2 max-h-[520px] overflow-y-auto pl-2">
            {filteredDocs.map(doc => {
              const isSelected = selectedDocs.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all group ${splitPreviewDoc?.id === doc.id ? 'border-primary bg-primary/8 ring-1 ring-primary/30' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
                >
                  <div onClick={e => e.stopPropagation()} className="shrink-0">
                    <Checkbox checked={isSelected} onChange={() => toggleSelect(doc.id)} />
                  </div>
                  <div
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => setSplitPreviewDoc(doc)}
                  >
                    <DocThumb doc={doc} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{doc.name}</p>
                      <p className="font-mono text-xs text-primary">{doc.number}</p>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleSingleDelete(doc); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 rounded text-destructive hover:bg-destructive/10 flex items-center justify-center transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <InlinePreview doc={splitPreviewDoc} />
        </div>
      );
    }

    if (viewMode === 'grid') return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredDocs.map(renderGridDoc)}
      </div>
    );
    return <div className="overflow-auto">{renderTableDocs()}</div>;
  };

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="space-y-6">

      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation('/projects')} className="gap-2 pr-0 hover:bg-transparent text-muted-foreground hover:text-foreground" data-testid="button-back-projects">
          <ArrowRight className="w-4 h-4" />
          العودة للمشاريع
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2" data-testid="button-edit-project">
            <Pencil className="w-4 h-4" />تعديل المشروع
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-2" data-testid="button-delete-project">
            <Trash2 className="w-4 h-4" />حذف المشروع
          </Button>
        </div>
      </div>

      {/* ── Banner ── */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-xl" style={{ height: '420px' }}>
        <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <Badge className={`text-sm px-3 py-1 font-semibold shadow-lg ${project.status === 'active' ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white' : 'bg-blue-500/90 hover:bg-blue-600 text-white'}`}>
            {project.status === 'active' ? '● نشط' : '✓ مكتمل'}
          </Badge>
          <span className="font-mono text-xs text-white/70 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">{project.number}</span>
        </div>

        {/* Bottom info — clean text, no boxes */}
        <div className="absolute bottom-0 inset-x-0 p-6 space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
            {project.name}
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
            <div>
              <p className="text-white/55 text-xs mb-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>العميل</p>
              <p className="text-white font-bold text-sm truncate" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{project.client}</p>
            </div>
            <div className="flex gap-1.5 items-start">
              <MapPin className="w-3.5 h-3.5 text-white/50 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-white/55 text-xs mb-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>المدينة</p>
                <p className="text-white font-bold text-sm truncate" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{project.city}</p>
              </div>
            </div>
            <div className="flex gap-1.5 items-start">
              <Building2 className="w-3.5 h-3.5 text-white/50 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-white/55 text-xs mb-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>نوع المشروع</p>
                <p className="text-white font-bold text-sm truncate" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{PROJECT_TYPES[project.projectType]}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <Clock className="w-3 h-3 text-white/50" />
                <p className="text-white/55 text-xs" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>تاريخ الإنشاء</p>
              </div>
              <p className="text-white font-medium text-xs" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{new Date(project.createdAt).toLocaleDateString('ar-SA')}</p>
              <p className="text-white/55 text-xs mt-1.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>آخر تحديث</p>
              <p className="text-white font-medium text-xs" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{new Date(project.updatedAt).toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">أقسام المستندات</h2>
          {selectedCategory !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory('all'); setSplitPreviewDoc(null); setSelectedDocs(new Set()); }}>
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
        {/* Bulk action bar */}
        {selectedDocs.size > 0 && (
          <div className="px-4 py-2.5 border-b border-border bg-primary/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">تم تحديد {selectedDocs.size} مستند</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDocs(new Set())}>إلغاء التحديد</Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                حذف المحددة
              </Button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{sectionTitle}</h2>
            <Badge variant="secondary" className="font-mono text-xs">{filteredDocs.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'grid' && filteredDocs.length > 0 && (
              <Button
                size="sm"
                variant={filteredDocs.every(d => selectedDocs.has(d.id)) ? 'default' : 'outline'}
                className="gap-1.5 text-xs h-8"
                onClick={() => {
                  const allSelected = filteredDocs.every(d => selectedDocs.has(d.id));
                  setSelectedDocs(allSelected ? new Set() : new Set(filteredDocs.map(d => d.id)));
                }}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {filteredDocs.every(d => selectedDocs.has(d.id)) ? 'إلغاء الكل' : 'تحديد الكل'}
              </Button>
            )}
            {!isSplitView && (
              <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
                {([['grid', LayoutGrid], ['list', List]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
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
              <Plus className="w-4 h-4" />إضافة
            </Button>
          </div>
        </div>

        <div className="p-4">{renderDocsContent()}</div>
      </Card>

      {/* ── Dialogs ── */}
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <AddDocumentsDialog open={addDocsOpen} onOpenChange={setAddDocsOpen} projectId={id} />
      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />

      {/* Project delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف المشروع؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف مشروع "<span className="font-semibold text-foreground">{project.name}</span>" وجميع مستنداته ({projectDocs.length} مستند) بشكل نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              حذف المشروع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk documents delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستندات المحددة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <span className="font-semibold text-foreground">{selectedDocs.size} مستند</span> بشكل نهائي. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف {selectedDocs.size} مستند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single document delete */}
      <AlertDialog open={!!singleDeleteDoc} onOpenChange={open => !open && setSingleDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستند</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف "<span className="font-semibold text-foreground">{singleDeleteDoc?.name}</span>" بشكل نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSingleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف المستند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
