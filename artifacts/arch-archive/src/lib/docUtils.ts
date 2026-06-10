import { DocumentType } from '../types';

export type PreviewType = 'image' | 'pdf' | 'word' | 'excel';

export function getPreviewType(docType: DocumentType): PreviewType {
  switch (docType) {
    case 'image':
    case 'drawing':
      return 'image';
    case 'contract':
    case 'quotation':
    case 'letter':
    case 'report':
      return 'pdf';
    case 'employee_data':
    case 'meeting':
      return 'word';
    case 'contractor':
      return 'excel';
    default:
      return 'pdf';
  }
}

export function getThumbnailUrl(docId: string, docType: DocumentType): string {
  const pt = getPreviewType(docType);
  if (pt === 'image') return `https://picsum.photos/seed/${docId}/400/300`;
  return '';
}

export const previewTypeColors: Record<PreviewType, { bg: string; label: string; ext: string }> = {
  image: { bg: 'from-emerald-700 to-teal-900', label: 'صورة', ext: 'IMG' },
  pdf: { bg: 'from-red-700 to-rose-900', label: 'PDF', ext: 'PDF' },
  word: { bg: 'from-blue-700 to-blue-900', label: 'وورد', ext: 'DOC' },
  excel: { bg: 'from-green-700 to-green-900', label: 'إكسل', ext: 'XLS' },
};

export const docTypeLabels: Record<DocumentType, string> = {
  contract: 'عقد',
  quotation: 'عرض سعر',
  employee_data: 'بيانات موظف',
  report: 'تقرير',
  image: 'صورة',
  meeting: 'اجتماع',
  letter: 'خطاب',
  contractor: 'مقاول',
  drawing: 'مخطط',
};
