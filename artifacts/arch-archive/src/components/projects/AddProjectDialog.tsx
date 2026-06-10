import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ProjectStatus, DocumentType, ProjectType, PROJECT_TYPES, CITIES } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Plus, Trash2, Upload } from 'lucide-react';

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DocRow {
  fileName: string;
  type: DocumentType | '';
}

export default function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const { projects, addProject, addDocument, getNextDocNumber } = useAppContext();

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [city, setCity] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const [docs, setDocs] = useState<DocRow[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const selectClass = "w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring";

  const handleAddDocRow = () => {
    setDocs(prev => [...prev, { fileName: '', type: '' }]);
  };

  const handleRemoveDocRow = (index: number) => {
    setDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (index: number, file: File | null) => {
    if (!file) return;
    const newDocs = [...docs];
    newDocs[index].fileName = file.name;
    setDocs(newDocs);
  };

  const handleTypeChange = (index: number, value: string) => {
    const newDocs = [...docs];
    newDocs[index].type = value as DocumentType;
    setDocs(newDocs);
  };

  const handleReset = () => {
    setName('');
    setClient('');
    setCity('');
    setProjectType('');
    setStatus('active');
    setStartDate('');
    setCoverUrl('');
    setDocs([]);
    fileInputRefs.current = [];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !client) return;

    const projectId = `proj_${Date.now()}`;
    const projectNumber = `PRJ-${String(projects.length + 1).padStart(3, '0')}`;
    const finalCover = coverUrl || `https://picsum.photos/seed/${projectId}/800/400`;
    const finalCity = city || CITIES[0];
    const finalType = (projectType || 'commercial') as ProjectType;

    addProject({
      id: projectId,
      number: projectNumber,
      name,
      client,
      city: finalCity,
      projectType: finalType,
      status,
      createdAt: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      coverImage: finalCover,
    });

    docs.forEach(doc => {
      if (doc.fileName && doc.type) {
        addDocument({
          id: `doc_${Date.now()}_${Math.random()}`,
          number: getNextDocNumber(doc.type as DocumentType),
          name: doc.fileName,
          type: doc.type as DocumentType,
          projectId,
          createdAt: new Date().toISOString(),
        });
      }
    });

    onOpenChange(false);
    handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset(); }}>
      <DialogContent className="max-w-3xl rtl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">إضافة مشروع جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">اسم المشروع *</Label>
              <Input
                id="add-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                data-testid="input-add-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-client">العميل *</Label>
              <Input
                id="add-client"
                required
                value={client}
                onChange={e => setClient(e.target.value)}
                data-testid="input-add-client"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-city">المدينة *</Label>
              <select
                id="add-city"
                className={selectClass}
                value={city}
                onChange={e => setCity(e.target.value)}
                required
                data-testid="select-add-city"
              >
                <option value="" disabled>اختر المدينة</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-type">نوع المشروع *</Label>
              <select
                id="add-type"
                className={selectClass}
                value={projectType}
                onChange={e => setProjectType(e.target.value as ProjectType)}
                required
                data-testid="select-add-type"
              >
                <option value="" disabled>اختر نوع المشروع</option>
                {(Object.entries(PROJECT_TYPES) as [ProjectType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">الحالة</Label>
              <select
                id="add-status"
                className={selectClass}
                value={status}
                onChange={e => setStatus(e.target.value as ProjectStatus)}
                data-testid="select-add-status"
              >
                <option value="active">نشط</option>
                <option value="completed">مكتمل</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-date">تاريخ البدء</Label>
              <Input
                id="add-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                dir="ltr"
                data-testid="input-add-date"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="add-cover">رابط صورة الغلاف (اختياري)</Label>
              <Input
                id="add-cover"
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                placeholder="يتم توليد صورة تلقائية إذا ترك فارغاً"
                dir="ltr"
                data-testid="input-add-cover"
              />
            </div>
          </div>

          {/* Documents section */}
          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center mb-4">
              <Label className="text-base font-semibold">إرفاق المستندات</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDocRow}
                className="gap-2"
                data-testid="button-add-doc-row"
              >
                <Plus className="w-4 h-4" />
                إضافة مستند
              </Button>
            </div>

            {docs.length === 0 ? (
              <div className="text-center py-5 text-sm text-muted-foreground bg-muted/50 rounded-md border border-dashed">
                اضغط "إضافة مستند" لإرفاق ملفات مع المشروع
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {docs.map((doc, index) => (
                  <div key={index} className="flex gap-2 items-center p-3 rounded-lg border border-border bg-muted/20">
                    {/* File upload */}
                    <div className="flex-1">
                      <input
                        type="file"
                        ref={el => { fileInputRefs.current[index] = el; }}
                        onChange={e => handleFileChange(index, e.target.files?.[0] || null)}
                        className="hidden"
                        id={`file-upload-${index}`}
                        data-testid={`input-file-${index}`}
                      />
                      <label
                        htmlFor={`file-upload-${index}`}
                        className="flex items-center gap-2 cursor-pointer h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className={`truncate ${doc.fileName ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {doc.fileName || 'اختر ملف للرفع...'}
                        </span>
                      </label>
                    </div>

                    {/* Doc type */}
                    <div className="w-44 shrink-0">
                      <select
                        className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={doc.type}
                        onChange={e => handleTypeChange(index, e.target.value)}
                        data-testid={`select-doc-type-${index}`}
                      >
                        <option value="" disabled>نوع المستند</option>
                        <option value="contract">عقد</option>
                        <option value="quotation">عرض سعر</option>
                        <option value="employee_data">بيانات موظف</option>
                        <option value="report">تقرير</option>
                        <option value="image">صورة</option>
                        <option value="meeting">اجتماع</option>
                        <option value="letter">خطاب</option>
                        <option value="contractor">مقاول</option>
                        <option value="drawing">مخطط</option>
                      </select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemoveDocRow(index)}
                      data-testid={`button-remove-doc-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); handleReset(); }}
            >
              إلغاء
            </Button>
            <Button type="submit" data-testid="button-submit-add-project">
              إضافة المشروع
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
