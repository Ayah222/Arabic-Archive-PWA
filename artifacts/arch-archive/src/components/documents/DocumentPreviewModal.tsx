import React from 'react';
import { Document } from '../../types';
import { getPreviewType, getThumbnailUrl, previewTypeColors, docTypeLabels } from '../../lib/docUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download, X, FileText, FileSpreadsheet, File } from 'lucide-react';

interface DocumentPreviewModalProps {
  doc: Document | null;
  onClose: () => void;
}

export default function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  if (!doc) return null;

  const previewType = getPreviewType(doc.type);
  const thumbUrl = getThumbnailUrl(doc.id, doc.type);
  const colors = previewTypeColors[previewType];
  const typeLabel = docTypeLabels[doc.type];

  const renderPreview = () => {
    if (previewType === 'image') {
      return (
        <div className="w-full rounded-lg overflow-hidden bg-black/20">
          <img
            src={thumbUrl}
            alt={doc.name}
            className="w-full object-contain max-h-96"
            style={{ maxHeight: '420px' }}
          />
        </div>
      );
    }

    if (previewType === 'pdf') {
      return (
        <div className={`w-full rounded-lg bg-gradient-to-br ${colors.bg} flex flex-col items-center justify-center gap-4 py-16`}>
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <div className="text-center">
            <div className="text-white/60 text-xs font-mono mb-1 uppercase tracking-widest">{colors.ext}</div>
            <div className="text-white font-semibold text-lg max-w-xs text-center px-4">{doc.name}</div>
          </div>
          <div className="mt-2 bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 text-center max-w-sm">
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-2 bg-white/20 rounded" />
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-2 bg-white/15 rounded w-full" />
              ))}
              <div className="h-2 bg-white/15 rounded w-2/3" />
            </div>
          </div>
        </div>
      );
    }

    if (previewType === 'word') {
      return (
        <div className={`w-full rounded-lg bg-gradient-to-br ${colors.bg} flex flex-col items-center justify-center gap-4 py-16`}>
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <File className="w-10 h-10 text-white" />
          </div>
          <div className="text-center">
            <div className="text-white/60 text-xs font-mono mb-1 uppercase tracking-widest">{colors.ext}</div>
            <div className="text-white font-semibold text-lg max-w-xs text-center px-4">{doc.name}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-8 py-5 max-w-sm w-full mx-4">
            <div className="space-y-2">
              <div className="h-3 bg-white/30 rounded w-3/4" />
              <div className="h-2 bg-white/20 rounded" />
              <div className="h-2 bg-white/20 rounded" />
              <div className="h-2 bg-white/20 rounded w-5/6" />
              <div className="mt-3 h-2 bg-white/20 rounded" />
              <div className="h-2 bg-white/20 rounded" />
              <div className="h-2 bg-white/20 rounded w-4/5" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`w-full rounded-lg bg-gradient-to-br ${colors.bg} flex flex-col items-center justify-center gap-4 py-16`}>
        <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <FileSpreadsheet className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <div className="text-white/60 text-xs font-mono mb-1 uppercase tracking-widest">{colors.ext}</div>
          <div className="text-white font-semibold text-lg max-w-xs text-center px-4">{doc.name}</div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 max-w-sm w-full mx-4">
          <div className="grid grid-cols-4 gap-1.5">
            {[...Array(16)].map((_, i) => (
              <div key={i} className={`h-6 rounded text-center flex items-center justify-center text-white/40 text-xs ${i < 4 ? 'bg-white/25 text-white/70 font-semibold' : 'bg-white/10'}`}>
                {i < 4 ? ['A', 'B', 'C', 'D'][i] : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={!!doc} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl rtl" data-testid="document-preview-modal">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center justify-between">
            <span>{doc.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {renderPreview()}

          <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/40 border border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-1">رقم المستند</p>
              <p className="font-mono font-semibold text-primary text-sm">{doc.number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">نوع المستند</p>
              <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">تاريخ الإضافة</p>
              <p className="text-sm font-medium">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <Button variant="outline" size="sm" className="gap-2" onClick={onClose}>
              <X className="w-4 h-4" />
              إغلاق
            </Button>
            <Button size="sm" className="gap-2" onClick={() => alert('تحميل المستند (محاكاة)')}>
              <Download className="w-4 h-4" />
              تحميل
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
