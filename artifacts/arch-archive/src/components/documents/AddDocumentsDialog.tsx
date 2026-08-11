import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { DocumentType } from '../../types';
import { docTypeLabels } from '../../lib/docUtils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Upload, Trash2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AddDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface FileRow {
  file: File;
  type: DocumentType | '';
  error?: string;
}

const DOC_TYPES: DocumentType[] = [
  'contract', 'quotation', 'employee_data', 'report',
  'image', 'meeting', 'letter', 'contractor', 'drawing',
];

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'avif', 'heic', 'heif', 'ico',
]);

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

function validateRow(file: File, type: DocumentType | ''): string | undefined {
  if (type === 'image' && !isImageFile(file.name)) {
    const ext = getExtension(file.name) || 'غير معروف';
    return `نوع الملف "${ext}" ليس صورة. يجب اختيار ملف بامتداد: jpg، jpeg، png، gif، webp، bmp، svg، tiff`;
  }
  return undefined;
}

export default function AddDocumentsDialog({ open, onOpenChange, projectId }: AddDocumentsDialogProps) {
  const { addDocument, getNextDocNumber } = useAppContext();
  const [rows, setRows] = useState<FileRow[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newRows: FileRow[] = Array.from(files).map(file => ({ file, type: '' }));
    setRows(prev => [...prev, ...newRows]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleTypeChange = (index: number, type: DocumentType) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const error = validateRow(r.file, type);
      return { ...r, type, error };
    }));
  };

  const handleRemove = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const hasErrors = rows.some(r => !!r.error);
  const allTypesSelected = rows.length > 0 && rows.every(r => r.type !== '');
  const canSave = allTypesSelected && !hasErrors;

  const handleSave = () => {
    if (!canSave) return;
    rows.forEach(row => {
      if (!row.type) return;
      addDocument({
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        number: getNextDocNumber(row.type as DocumentType),
        name: row.file.name,
        type: row.type as DocumentType,
        projectId,
        createdAt: new Date().toISOString(),
      });
    });
    setRows([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setRows([]);
    onOpenChange(false);
  };

  const selectClass = "w-full h-9 px-2 py-1 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl rtl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            إضافة مستندات للمشروع
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-primary/40 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            data-testid="drop-zone"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">اسحب الملفات هنا أو انقر للاختيار</p>
              <p className="text-sm text-muted-foreground mt-1">يمكنك اختيار ملفات متعددة في نفس الوقت</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2 mt-1">
              <Plus className="w-4 h-4" />
              اختيار ملفات
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleFilesSelected(e.target.files)}
              data-testid="input-multi-file"
            />
          </div>

          {/* Files list */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{rows.length} ملف محدد</p>
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRows([])}>
                  مسح الكل
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {rows.map((row, index) => (
                  <div key={index} className="space-y-1">
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${row.error ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/20 hover:bg-muted/40'}`}
                      data-testid={`file-row-${index}`}
                    >
                      {/* File icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${row.error ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        <span className={`text-xs font-bold uppercase ${row.error ? 'text-destructive' : 'text-primary'}`}>
                          {getExtension(row.file.name).slice(0, 3) || 'DOC'}
                        </span>
                      </div>

                      {/* File name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={row.file.name}>{row.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(row.file.size / 1024).toFixed(0)} KB</p>
                      </div>

                      {/* Type selector */}
                      <div className="w-36 shrink-0">
                        <select
                          className={`${selectClass} ${row.error ? 'border-destructive focus:ring-destructive' : ''}`}
                          value={row.type}
                          onChange={e => handleTypeChange(index, e.target.value as DocumentType)}
                          data-testid={`select-file-type-${index}`}
                        >
                          <option value="" disabled>نوع المستند</option>
                          {DOC_TYPES.map(t => (
                            <option key={t} value={t}>{docTypeLabels[t]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status icon */}
                      {row.error ? (
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      ) : row.type ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}

                      {/* Remove */}
                      <Button type="button" variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleRemove(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Error message */}
                    {row.error && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/8 border border-destructive/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive leading-relaxed">{row.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!allTypesSelected && !hasErrors && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  يرجى تحديد نوع لجميع الملفات قبل الحفظ
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="gap-2"
            data-testid="button-save-documents"
          >
            <Upload className="w-4 h-4" />
            حفظ {rows.length > 0 ? `(${rows.length} مستند)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
