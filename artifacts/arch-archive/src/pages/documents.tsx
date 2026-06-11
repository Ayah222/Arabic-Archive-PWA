import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { DocumentType } from '../types';
import { docTypeLabels, getPreviewType, getThumbnailUrl, previewTypeColors } from '../lib/docUtils';
import { Document } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Trash2, Eye, CheckSquare, FileText, List, Table2, ArrowUpDown } from 'lucide-react';
import DocumentPreviewModal from '../components/documents/DocumentPreviewModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';

type ViewMode = 'table' | 'list';

/* ── Thumbnail ── */
function DocThumb({ doc, size = 'sm' }: { doc: Document; size?: 'sm' | 'md' }) {
  const pt = getPreviewType(doc.type);
  const thumb = getThumbnailUrl(doc.id, doc.type);
  const col = previewTypeColors[pt];
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-full h-36';
  const iconSize = size === 'sm' ? 'text-xs' : 'text-base';

  if (pt === 'image' && thumb) {
    return (
      <div className={`${dim} overflow-hidden bg-muted rounded-lg shrink-0`}>
        <img src={thumb} alt={doc.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${dim} bg-gradient-to-br ${col.bg} rounded-lg flex flex-col items-center justify-center gap-0.5 shrink-0`}>
      <span className={`font-bold text-white/90 font-mono ${iconSize}`}>{col.ext}</span>
      {size === 'md' && <span className="text-white/60 text-xs">{col.label}</span>}
    </div>
  );
}

const DOC_TYPES: DocumentType[] = [
  'contract', 'quotation', 'employee_data', 'report',
  'image', 'meeting', 'letter', 'contractor', 'drawing',
];

const selectClass = "h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function Documents() {
  const { documents, projects, deleteDocument, deleteDocuments } = useAppContext();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const initialProjectId = searchParams.get('project') || 'all';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteDoc, setSingleDeleteDoc] = useState<Document | null>(null);

  const filteredDocs = useMemo(() => documents
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
    }), [documents, typeFilter, projectFilter, search, sortOrder]);

  /* ── Selection ── */
  const isAllSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedDocs.has(d.id));

  const toggleSelect = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedDocs(new Set());
    else setSelectedDocs(new Set(filteredDocs.map(d => d.id)));
  };

  const handleBulkDelete = () => {
    deleteDocuments(Array.from(selectedDocs));
    setSelectedDocs(new Set());
    setBulkDeleteOpen(false);
  };

  const confirmSingleDelete = () => {
    if (!singleDeleteDoc) return;
    deleteDocument(singleDeleteDoc.id);
    setSelectedDocs(prev => { const n = new Set(prev); n.delete(singleDeleteDoc.id); return n; });
    if (previewDoc?.id === singleDeleteDoc.id) setPreviewDoc(null);
    setSingleDeleteDoc(null);
  };

  /* ── Grid card ── */
  const renderGridDoc = (doc: Document) => {
    const isSelected = selectedDocs.has(doc.id);
    const project = projects.find(p => p.id === doc.projectId);
    return (
      <div
        key={doc.id}
        className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all group ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card hover:border-primary hover:shadow-md'}`}
        onClick={() => setPreviewDoc(doc)}
      >
        {/* Checkbox */}
        <div className="absolute top-2 right-2 z-10" onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}>
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="w-4 h-4 rounded border-border cursor-pointer accent-primary" />
        </div>
        {/* Delete on hover */}
        <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); setSingleDeleteDoc(doc); }}>
          <button className="w-6 h-6 rounded-md bg-destructive/90 text-white flex items-center justify-center hover:bg-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <DocThumb doc={doc} size="md" />
        <div className="p-3">
          <p className="font-mono text-xs text-primary font-bold mb-0.5">{doc.number}</p>
          <p className="text-xs font-semibold truncate mb-1" title={doc.name}>{doc.name}</p>
          {project && (
            <p className="text-xs text-muted-foreground truncate mb-1.5">{project.name}</p>
          )}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{docTypeLabels[doc.type]}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── List item ── */
  const renderListDoc = (doc: Document) => {
    const isSelected = selectedDocs.has(doc.id);
    const project = projects.find(p => p.id === doc.projectId);
    return (
      <div
        key={doc.id}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary'}`}
      >
        <div onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="w-4 h-4 rounded border-border cursor-pointer accent-primary" />
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
          <DocThumb doc={doc} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{doc.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="font-mono text-xs text-primary">{doc.number}</span>
              <Badge variant="outline" className="text-xs h-4">{docTypeLabels[doc.type]}</Badge>
              {project && <span className="text-xs text-muted-foreground truncate max-w-[140px]">{project.name}</span>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setSingleDeleteDoc(doc); }}
          className="shrink-0 w-7 h-7 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  /* ── Table ── */
  const renderTable = () => (
    <Table>
      <TableHeader>
        <TableRow className="border-b-2 border-border bg-muted/60">
          <TableHead className="text-right py-3 px-3 w-10">
            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border cursor-pointer accent-primary" />
          </TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-3 w-14">معاينة</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">رقم المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">اسم المستند</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">المشروع</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">النوع</TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-4">
            <button className="flex items-center gap-1 hover:text-primary transition-colors" onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}>
              تاريخ الإضافة
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </TableHead>
          <TableHead className="text-right font-bold text-foreground py-3 px-3 w-24">الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDocs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 opacity-30" />
                <p>لا توجد مستندات تطابق معايير البحث</p>
              </div>
            </TableCell>
          </TableRow>
        ) : filteredDocs.map((doc, i) => {
          const project = projects.find(p => p.id === doc.projectId);
          const isSelected = selectedDocs.has(doc.id);
          return (
            <TableRow
              key={doc.id}
              className={`border-b border-border transition-colors ${isSelected ? 'bg-primary/5' : i % 2 === 0 ? 'bg-background hover:bg-muted/30' : 'bg-muted/10 hover:bg-muted/30'}`}
            >
              <TableCell className="py-2 px-3" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="w-4 h-4 rounded border-border cursor-pointer accent-primary" />
              </TableCell>
              <TableCell className="py-2 px-3">
                <div className="cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                  <DocThumb doc={doc} size="sm" />
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm font-bold text-primary py-3 px-4">{doc.number}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate py-3 px-4 cursor-pointer" onClick={() => setPreviewDoc(doc)} title={doc.name}>{doc.name}</TableCell>
              <TableCell className="py-3 px-4">
                <button
                  className="text-primary hover:underline text-sm max-w-[160px] truncate text-right block"
                  onClick={() => setLocation(`/projects/${doc.projectId}`)}
                >
                  {project?.name || 'مشروع غير معروف'}
                </button>
              </TableCell>
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
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setSingleDeleteDoc(doc)}>
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

  /* ── Render ── */
  return (
    <div className="space-y-5">

      {/* Page title + stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المستندات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إجمالي: {documents.length} مستند</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="البحث برقم المستند أو اسمه..."
                className="pr-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select className={selectClass} value={typeFilter} onChange={e => setTypeFilter(e.target.value as DocumentType | 'all')}>
                <option value="all">كل الأنواع</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{docTypeLabels[t]}</option>)}
              </select>
              <select className={`${selectClass} max-w-[180px]`} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                <option value="all">كل المشاريع</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className={selectClass} value={sortOrder} onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}>
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results card */}
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
                <Trash2 className="w-3.5 h-3.5" />حذف المحددة
              </Button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredDocs.length === documents.length
              ? `${filteredDocs.length} مستند`
              : `${filteredDocs.length} من ${documents.length} مستند`}
          </p>
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            {([['table', Table2], ['list', List]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'table' && (
          <div className="overflow-auto">{renderTable()}</div>
        )}
        {viewMode === 'list' && (
          <div className="p-4 space-y-2">
            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <FileText className="w-10 h-10 opacity-30" />
                <p>لا توجد مستندات تطابق معايير البحث</p>
              </div>
            ) : filteredDocs.map(renderListDoc)}
          </div>
        )}
      </Card>

      {/* ── Modals ── */}
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستندات المحددة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <span className="font-semibold text-foreground">{selectedDocs.size} مستند</span> بشكل نهائي. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف {selectedDocs.size} مستند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!singleDeleteDoc} onOpenChange={open => !open && setSingleDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستند</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف "<span className="font-semibold text-foreground">{singleDeleteDoc?.name}</span>" بشكل نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
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
