import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Project, ProjectStatus, ProjectType, PROJECT_TYPES, CITIES } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export default function EditProjectDialog({ open, onOpenChange, project }: EditProjectDialogProps) {
  const { updateProject } = useAppContext();

  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client);
  const [city, setCity] = useState(project.city);
  const [projectType, setProjectType] = useState<ProjectType>(project.projectType);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.createdAt.split('T')[0]);
  const [coverUrl, setCoverUrl] = useState(project.coverImage);

  useEffect(() => {
    setName(project.name);
    setClient(project.client);
    setCity(project.city);
    setProjectType(project.projectType);
    setStatus(project.status);
    setStartDate(project.createdAt.split('T')[0]);
    setCoverUrl(project.coverImage);
  }, [project]);

  const selectClass = "w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !client) return;

    updateProject(project.id, {
      name,
      client,
      city,
      projectType,
      status,
      createdAt: new Date(startDate).toISOString(),
      coverImage: coverUrl || project.coverImage,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">تعديل المشروع</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">اسم المشروع *</Label>
              <Input
                id="edit-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                data-testid="input-edit-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client">العميل *</Label>
              <Input
                id="edit-client"
                required
                value={client}
                onChange={e => setClient(e.target.value)}
                data-testid="input-edit-client"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-city">المدينة</Label>
              <select
                id="edit-city"
                className={selectClass}
                value={city}
                onChange={e => setCity(e.target.value)}
                data-testid="select-edit-city"
              >
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">نوع المشروع</Label>
              <select
                id="edit-type"
                className={selectClass}
                value={projectType}
                onChange={e => setProjectType(e.target.value as ProjectType)}
                data-testid="select-edit-type"
              >
                {(Object.entries(PROJECT_TYPES) as [ProjectType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">الحالة</Label>
              <select
                id="edit-status"
                className={selectClass}
                value={status}
                onChange={e => setStatus(e.target.value as ProjectStatus)}
                data-testid="select-edit-status"
              >
                <option value="active">نشط</option>
                <option value="completed">مكتمل</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">تاريخ البدء</Label>
              <Input
                id="edit-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                dir="ltr"
                data-testid="input-edit-date"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="edit-cover">رابط صورة الغلاف</Label>
              <Input
                id="edit-cover"
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                placeholder="رابط الصورة"
                dir="ltr"
                data-testid="input-edit-cover"
              />
              {coverUrl && (
                <div className="h-28 rounded-lg overflow-hidden border border-border mt-2">
                  <img src={coverUrl} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" data-testid="button-save-edit">حفظ التعديلات</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
