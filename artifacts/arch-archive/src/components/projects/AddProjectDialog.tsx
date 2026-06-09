import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ProjectStatus, DocumentType } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const { projects, addProject, addDocument, getNextDocNumber } = useAppContext();
  
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [coverUrl, setCoverUrl] = useState('');
  
  const [docs, setDocs] = useState<{name: string, type: DocumentType}[]>([]);

  const handleAddDocRow = () => {
    setDocs([...docs, { name: '', type: 'contract' }]);
  };

  const handleRemoveDocRow = (index: number) => {
    setDocs(docs.filter((_, i) => i !== index));
  };

  const handleUpdateDocRow = (index: number, field: 'name' | 'type', value: string) => {
    const newDocs = [...docs];
    if (field === 'name') newDocs[index].name = value;
    else newDocs[index].type = value as DocumentType;
    setDocs(newDocs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !client) return;

    const projectId = `proj_${Date.now()}`;
    const projectNumber = `PRJ-${String(projects.length + 1).padStart(3, '0')}`;
    const finalCover = coverUrl || `https://picsum.photos/seed/${projectId}/800/400`;

    addProject({
      id: projectId,
      number: projectNumber,
      name,
      client,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      coverImage: finalCover
    });

    docs.forEach(doc => {
      if (doc.name) {
        addDocument({
          id: `doc_${Date.now()}_${Math.random()}`,
          number: getNextDocNumber(doc.type),
          name: doc.name,
          type: doc.type,
          projectId,
          createdAt: new Date().toISOString()
        });
      }
    });

    onOpenChange(false);
    
    // Reset state
    setName('');
    setClient('');
    setStatus('active');
    setCoverUrl('');
    setDocs([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">إضافة مشروع جديد</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المشروع *</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>العميل *</Label>
              <Input required value={client} onChange={e => setClient(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <select 
                className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                value={status}
                onChange={e => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="active">نشط</option>
                <option value="completed">مكتمل</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>رابط صورة الغلاف (اختياري)</Label>
              <Input 
                value={coverUrl} 
                onChange={e => setCoverUrl(e.target.value)} 
                placeholder="يتم توليد صورة تلقائية إذا ترك فارغاً" 
                dir="ltr"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <Label className="text-base font-semibold">المستندات المرفقة</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddDocRow} className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة مستند
              </Button>
            </div>

            {docs.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground bg-muted/50 rounded-md border border-dashed">
                لا توجد مستندات مضافة
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {docs.map((doc, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Input 
                        placeholder="اسم المستند" 
                        value={doc.name}
                        onChange={e => handleUpdateDocRow(index, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="w-1/3 space-y-1">
                      <select 
                        className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                        value={doc.type}
                        onChange={e => handleUpdateDocRow(index, 'type', e.target.value)}
                      >
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
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveDocRow(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit">إضافة المشروع</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
