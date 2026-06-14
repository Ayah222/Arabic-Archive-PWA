import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { DocumentType } from '../types';
import { docTypeLabels, getPreviewType, getThumbnailUrl, previewTypeColors } from '../lib/docUtils';
import { Document } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Search, Trash2, Eye, CheckSquare, FileText, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import DocumentPreviewModal from '../components/documents/DocumentPreviewModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';

type ViewMode = 'grid' | 'list';

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
        <img src={thumb} alt={doc.name} className="w-full h-full object-cover"/>
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

/* ── Hover neon card ── */
function NeonCard({ children, accent = '#00f0ff', isDark, className = '', style: extraStyle }: {
  children: React.ReactNode; accent?: string; isDark: boolean; className?: string; style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${className}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.024)' : 'rgba(255,255,255,0.68)',
        backdropFilter: 'blur(20px) saturate(200%)',
        WebkitBackdropFilter: 'blur(20px) saturate(200%)',
        border: hovered ? `1px solid ${accent}60` : isDark ? `1px solid ${accent}18` : `1px solid ${accent}25`,
        boxShadow: hovered
          ? isDark ? `inset 0 1px 2px rgba(255,255,255,0.10), 0 0 20px ${accent}18, 0 12px 40px rgba(0,0,0,0.55)` : `inset 0 1px 3px rgba(255,255,255,0.90), 0 0 16px ${accent}14, 0 10px 30px rgba(31,38,135,0.08)`
          : isDark ? 'inset 0 1px 2px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.44)' : 'inset 0 1px 3px rgba(255,255,255,0.80), 0 4px 14px rgba(31,38,135,0.05)',
        ...extraStyle,
      }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background: isDark
        ? `linear-gradient(to right, transparent 5%, ${accent}${hovered?'70':'25'} 40%, rgba(255,255,255,${hovered?'0.18':'0.06'}) 50%, ${accent}${hovered?'70':'25'} 60%, transparent 95%)`
        : `linear-gradient(to right, transparent 5%, rgba(255,255,255,0.95) 25%, ${accent}${hovered?'50':'25'} 50%, rgba(255,255,255,0.95) 75%, transparent 95%)`,
        transition: 'all 0.2s ease',
      }}/>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

const DOC_TYPES: DocumentType[] = [
  'contract', 'quotation', 'employee_data', 'report',
  'image', 'meeting', 'letter', 'contractor', 'drawing',
];

export default function Documents() {
  const { documents, projects, deleteDocument, deleteDocuments, theme } = useAppContext();
  const [, setLocation] = useLocation();
  const isDark = theme === 'dark';

  const searchParams = new URLSearchParams(window.location.search);
  const initialProjectId = searchParams.get('project') || 'all';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
      const dA = new Date(a.createdAt).getTime(), dB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dB - dA : dA - dB;
    }), [documents, typeFilter, projectFilter, search, sortOrder]);

  const isAllSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedDocs.has(d.id));
  const toggleSelect = (id: string) => setSelectedDocs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => { if (isAllSelected) setSelectedDocs(new Set()); else setSelectedDocs(new Set(filteredDocs.map(d => d.id))); };
  const handleBulkDelete = () => { deleteDocuments(Array.from(selectedDocs)); setSelectedDocs(new Set()); setBulkDeleteOpen(false); };
  const confirmSingleDelete = () => {
    if (!singleDeleteDoc) return;
    deleteDocument(singleDeleteDoc.id);
    setSelectedDocs(prev => { const n = new Set(prev); n.delete(singleDeleteDoc.id); return n; });
    if (previewDoc?.id === singleDeleteDoc.id) setPreviewDoc(null);
    setSingleDeleteDoc(null);
  };

  /* ── Text tokens ── */
  const c = {
    title:     isDark ? '#ffffff'               : '#1e1b4b',
    body:      isDark ? 'rgba(255,255,255,0.92)': '#1e293b',
    secondary: isDark ? 'rgba(255,255,255,0.72)': '#334155',
    muted:     isDark ? 'rgba(255,255,255,0.50)': '#64748b',
    numIndigo: isDark ? '#818cf8'               : '#4338ca',
    headIndigo:isDark ? 'rgba(129,140,248,0.85)': '#4338ca',
    rowBorder: isDark ? 'rgba(129,140,248,0.07)': 'rgba(99,102,241,0.10)',
    rowHover:  isDark ? 'rgba(129,140,248,0.05)': 'rgba(99,102,241,0.05)',
    rowAlt:    isDark ? 'rgba(255,255,255,0.015)': 'rgba(30,27,75,0.025)',
    hdrBg:     isDark ? 'rgba(129,140,248,0.04)': 'rgba(99,102,241,0.04)',
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.80)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(99,102,241,0.18)',
    color: isDark ? 'rgba(255,255,255,0.88)' : '#1e1b4b',
    borderRadius: 10, padding: '8px 12px', fontSize: 14, outline: 'none',
  };

  /* ── Doc type pill ── */
  const docPill = (type: DocumentType) => isDark
    ? { bg:'rgba(129,140,248,0.12)', text:'#818cf8', border:'rgba(129,140,248,0.30)' }
    : { bg:'rgba(99,102,241,0.09)', text:'#4338ca', border:'rgba(99,102,241,0.24)' };

  /* ── Grid card ── */
  const renderGridDoc = (doc: Document) => {
    const isSelected = selectedDocs.has(doc.id);
    const project = projects.find(p => p.id === doc.projectId);
    const pt = getPreviewType(doc.type);
    const thumb = getThumbnailUrl(doc.id, doc.type);
    const col = previewTypeColors[pt];
    const pill = docPill(doc.type);
    return (
      <div key={doc.id}
        className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 group"
        style={{
          background: isDark ? 'rgba(255,255,255,0.024)' : 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isSelected
            ? isDark ? '1px solid rgba(129,140,248,0.70)' : '1px solid rgba(99,102,241,0.60)'
            : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.14)',
          boxShadow: isSelected
            ? isDark ? '0 0 20px rgba(129,140,248,0.22)' : '0 4px 20px rgba(99,102,241,0.15)'
            : isDark ? '0 4px 16px rgba(0,0,0,0.40)' : '0 2px 10px rgba(31,38,135,0.05)',
        }}
        onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.border = isDark ? '1px solid rgba(129,140,248,0.50)' : '1px solid rgba(99,102,241,0.45)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; } }}
        onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.border = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.14)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; } }}
        onClick={() => setPreviewDoc(doc)}>
        {/* Checkbox */}
        <div className="absolute top-0 right-0 z-20 w-11 h-11 flex items-start justify-end p-2.5 cursor-pointer"
          onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-sm ${isSelected ? 'bg-primary border-primary' : 'bg-white/80 border-white/70 backdrop-blur-sm hover:border-primary/80'}`}>
            {isSelected && <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </div>
        {/* Delete on hover */}
        <div className="absolute top-2.5 left-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          onClick={e => { e.stopPropagation(); setSingleDeleteDoc(doc); }}>
          <button className="w-7 h-7 rounded-lg bg-destructive/90 backdrop-blur-sm text-white flex items-center justify-center hover:bg-destructive shadow-md">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
        {/* Preview */}
        <div className="h-44 overflow-hidden relative">
          {pt === 'image' && thumb
            ? <img src={thumb} alt={doc.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"/>
            : <div className={`w-full h-full bg-gradient-to-br ${col.bg} flex flex-col items-center justify-center gap-2 select-none`}>
                <span className="text-5xl font-black text-white/80 font-mono tracking-tighter leading-none">{col.ext}</span>
                <span className="text-sm text-white/55 font-medium">{col.label}</span>
              </div>
          }
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/15 to-transparent pointer-events-none"/>
        </div>
        {/* Info */}
        <div className="p-3 space-y-1.5">
          <p className="font-mono text-xs font-bold" style={{ color: c.numIndigo }}>{doc.number}</p>
          {project && <p className="text-xs truncate" style={{ color: c.muted }}>{project.name}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: pill.bg, color: pill.text, border:`1px solid ${pill.border}` }}>
              {docTypeLabels[doc.type]}
            </span>
            <span className="text-xs whitespace-nowrap" style={{ color: c.muted }}>{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── List item ── */
  const renderListDoc = (doc: Document) => {
    const isSelected = selectedDocs.has(doc.id);
    const project = projects.find(p => p.id === doc.projectId);
    const pill = docPill(doc.type);
    return (
      <div key={doc.id}
        className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
        style={{
          background: isSelected
            ? isDark ? 'rgba(129,140,248,0.08)' : 'rgba(99,102,241,0.06)'
            : 'transparent',
          border: isSelected
            ? isDark ? '1px solid rgba(129,140,248,0.45)' : '1px solid rgba(99,102,241,0.40)'
            : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.10)',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(129,140,248,0.35)' : 'rgba(99,102,241,0.30)'; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.10)'; }}>
        <div onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="w-4 h-4 rounded border-border cursor-pointer accent-primary"/>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
          <DocThumb doc={doc} size="sm"/>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: c.body }}>{doc.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="font-mono text-xs font-bold" style={{ color: c.numIndigo }}>{doc.number}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: pill.bg, color: pill.text, border:`1px solid ${pill.border}` }}>
                {docTypeLabels[doc.type]}
              </span>
              {project && <span className="text-xs truncate max-w-[140px]" style={{ color: c.muted }}>{project.name}</span>}
            </div>
          </div>
          <p className="text-xs whitespace-nowrap shrink-0" style={{ color: c.muted }}>{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); setSingleDeleteDoc(doc); }}
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors"
          style={{ color: '#ef4444' }}>
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      </div>
    );
  };

  /* ── Table (list view) — "معاينة" column removed ── */
  const renderTable = () => (
    <Table>
      <TableHeader>
        <TableRow style={{ borderBottom:`1px solid ${c.rowBorder}`, background: c.hdrBg }}>
          <TableHead className="text-right py-3 px-3 w-10">
            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border cursor-pointer accent-primary"/>
          </TableHead>
          {['رقم المستند','اسم المستند','المشروع','النوع','تاريخ الإضافة'].map(h => (
            <TableHead key={h} className="text-right font-bold py-3 px-4 text-xs whitespace-nowrap" style={{ color: c.headIndigo }}>{h}</TableHead>
          ))}
          <TableHead className="text-right font-bold py-3 px-3 w-20 text-xs" style={{ color: c.headIndigo }}>الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDocs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-12">
              <div className="flex flex-col items-center gap-2" style={{ color: c.muted }}>
                <FileText className="w-10 h-10 opacity-30"/>
                <p>لا توجد مستندات تطابق معايير البحث</p>
              </div>
            </TableCell>
          </TableRow>
        ) : filteredDocs.map((doc, i) => {
          const project = projects.find(p => p.id === doc.projectId);
          const isSelected = selectedDocs.has(doc.id);
          const pill = docPill(doc.type);
          return (
            <TableRow key={doc.id}
              style={{ borderBottom:`1px solid ${c.rowBorder}`, background: isSelected ? (isDark ? 'rgba(129,140,248,0.07)' : 'rgba(99,102,241,0.05)') : i%2===0 ? 'transparent' : c.rowAlt }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = c.rowHover; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i%2===0 ? 'transparent' : c.rowAlt; }}>
              <TableCell className="py-2 px-3" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="w-4 h-4 rounded border-border cursor-pointer accent-primary"/>
              </TableCell>
              <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color: c.numIndigo }}>{doc.number}</TableCell>
              <TableCell className="font-bold max-w-[200px] truncate py-3 px-4 cursor-pointer" style={{ color: c.body }} onClick={() => setPreviewDoc(doc)} title={doc.name}>{doc.name}</TableCell>
              <TableCell className="py-3 px-4">
                <button className="text-sm max-w-[160px] truncate text-right block font-medium transition-opacity hover:opacity-70"
                  style={{ color: c.numIndigo }}
                  onClick={() => setLocation(`/projects/${doc.projectId}`)}>
                  {project?.name || 'مشروع غير معروف'}
                </button>
              </TableCell>
              <TableCell className="py-3 px-4">
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: pill.bg, color: pill.text, border:`1px solid ${pill.border}` }}>
                  {docTypeLabels[doc.type]}
                </span>
              </TableCell>
              <TableCell className="py-3 px-4 whitespace-nowrap text-sm font-medium" style={{ color: c.muted }}>
                {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
              </TableCell>
              <TableCell className="py-3 px-3">
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:opacity-70"
                    style={{ color: isDark ? '#818cf8' : '#4338ca' }}
                    onClick={() => setPreviewDoc(doc)}>
                    <Eye className="w-3.5 h-3.5"/>
                  </button>
                  <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:opacity-70"
                    style={{ color: '#ef4444' }}
                    onClick={() => setSingleDeleteDoc(doc)}>
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#1e1b4b' }}>المستندات</h1>
          <p className="text-sm mt-0.5 font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
            إجمالي: {documents.length} مستند
          </p>
        </div>
      </div>

      {/* Filter panel */}
      <NeonCard accent={isDark ? '#818cf8' : '#6366f1'} isDark={isDark}>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: c.muted }}/>
              <input
                placeholder="البحث برقم المستند أو اسمه..."
                className="w-full h-10 rounded-xl text-sm outline-none transition-all"
                style={{ ...inputStyle, paddingRight: 36 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value as DocumentType | 'all')}>
                <option value="all">كل الأنواع</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{docTypeLabels[t]}</option>)}
              </select>
              <select style={{ ...inputStyle, maxWidth: 180 }} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                <option value="all">كل المشاريع</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select style={inputStyle} value={sortOrder} onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}>
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>
          </div>
        </div>
      </NeonCard>

      {/* Results card */}
      <NeonCard accent={isDark ? '#818cf8' : '#6366f1'} isDark={isDark}>
        {/* Bulk action bar */}
        {selectedDocs.size > 0 && (
          <div className="px-4 py-2.5 flex items-center justify-between gap-3"
            style={{ borderBottom: isDark ? '1px solid rgba(129,140,248,0.10)' : '1px solid rgba(99,102,241,0.10)', background: isDark ? 'rgba(129,140,248,0.06)' : 'rgba(99,102,241,0.04)' }}>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" style={{ color: isDark ? '#818cf8' : '#4338ca' }}/>
              <span className="text-sm font-semibold" style={{ color: isDark ? '#818cf8' : '#4338ca' }}>تم تحديد {selectedDocs.size} مستند</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: c.muted }} onClick={() => setSelectedDocs(new Set())}>
                إلغاء التحديد
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}
                onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5"/>حذف المحددة
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderBottom: isDark ? '1px solid rgba(129,140,248,0.08)' : '1px solid rgba(99,102,241,0.08)' }}>
          <p className="text-sm font-medium" style={{ color: c.muted }}>
            {filteredDocs.length === documents.length ? `${filteredDocs.length} مستند` : `${filteredDocs.length} من ${documents.length} مستند`}
          </p>
          <div className="flex items-center gap-2">
            {viewMode === 'grid' && filteredDocs.length > 0 && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  color: isDark ? '#818cf8' : '#4338ca',
                  border: isDark ? '1px solid rgba(129,140,248,0.25)' : '1px solid rgba(99,102,241,0.22)',
                  background: isDark ? 'rgba(129,140,248,0.07)' : 'rgba(99,102,241,0.06)',
                }}
                onClick={() => setSelectedDocs(filteredDocs.every(d => selectedDocs.has(d.id)) ? new Set() : new Set(filteredDocs.map(d => d.id)))}>
                <CheckSquare className="w-3.5 h-3.5"/>
                {filteredDocs.every(d => selectedDocs.has(d.id)) ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            )}
            {/* View mode toggle */}
            <div className="flex rounded-xl overflow-hidden"
              style={{ border: isDark ? '1px solid rgba(129,140,248,0.22)' : '1px solid rgba(99,102,241,0.18)', background: isDark ? 'rgba(129,140,248,0.05)' : 'rgba(99,102,241,0.05)' }}>
              {([['grid', LayoutGrid], ['list', List]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
                <button key={mode}
                  onClick={() => setViewMode(mode)}
                  className="p-2 transition-all duration-150"
                  style={viewMode === mode ? { background: isDark ? 'rgba(129,140,248,0.20)' : 'rgba(99,102,241,0.14)', color: isDark ? '#818cf8' : '#4338ca' } : { color: c.muted }}>
                  <Icon className="w-4 h-4"/>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'grid' ? (
          <div className="p-4">
            {filteredDocs.length === 0
              ? <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: c.muted }}>
                  <FileText className="w-10 h-10 opacity-30"/>
                  <p>لا توجد مستندات تطابق معايير البحث</p>
                </div>
              : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredDocs.map(renderGridDoc)}
                </div>
            }
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredDocs.length === 0
              ? <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: c.muted }}>
                  <FileText className="w-10 h-10 opacity-30"/>
                  <p>لا توجد مستندات تطابق معايير البحث</p>
                </div>
              : filteredDocs.map(renderListDoc)
            }
          </div>
        )}
      </NeonCard>

      {/* Modals */}
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)}/>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستندات المحددة</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف <span className="font-semibold">{selectedDocs.size} مستند</span> بشكل نهائي.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
            <AlertDialogDescription>سيتم حذف "<span className="font-semibold">{singleDeleteDoc?.name}</span>" بشكل نهائي.</AlertDialogDescription>
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
