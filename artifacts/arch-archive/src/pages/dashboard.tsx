import React, { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { FolderKanban, CheckCircle2, Clock, FileText } from 'lucide-react';
import { PROJECT_TYPES } from '../types';

export default function Dashboard() {
  const { projects, documents } = useAppContext();
  const [, setLocation] = useLocation();

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const active = projects.filter(p => p.status === 'active').length;
    return { total, completed, active };
  }, [projects]);

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 7);

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const docTypeLabels: Record<string, string> = {
    contract: 'عقد', quotation: 'عرض سعر', employee_data: 'بيانات موظف',
    report: 'تقرير', image: 'صورة', meeting: 'اجتماع', letter: 'خطاب',
    contractor: 'مقاول', drawing: 'مخطط',
  };

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setLocation('/projects')}
          data-testid="kpi-total"
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي المشاريع</p>
              <div className="flex items-end gap-2">
                <h3 className="text-3xl font-bold" data-testid="kpi-total-count">{stats.total}</h3>
                <span className="text-xs text-green-600 font-medium mb-1">+5 هذا الشهر</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setLocation('/projects?status=completed')}
          data-testid="kpi-completed"
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">المشاريع المكتملة</p>
              <div className="flex items-end gap-2">
                <h3 className="text-3xl font-bold" data-testid="kpi-completed-count">{stats.completed}</h3>
                <span className="text-xs text-blue-600 font-medium mb-1">+2 هذا الشهر</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setLocation('/projects?status=active')}
          data-testid="kpi-active"
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">المشاريع النشطة</p>
              <div className="flex items-end gap-2">
                <h3 className="text-3xl font-bold" data-testid="kpi-active-count">{stats.active}</h3>
                <span className="text-xs text-green-600 font-medium mb-1">+3 هذا الشهر</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Projects */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">أحدث المشاريع</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border bg-muted/60 sticky top-0">
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border first:border-r-0 last:border-l-0 whitespace-nowrap">رقم المشروع</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">اسم المشروع</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">العميل</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">المدينة</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">نوع المشروع</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">تاريخ الإنشاء</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">آخر تحديث</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 border-x border-border whitespace-nowrap">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProjects.map((p, i) => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer hover:bg-primary/5 border-b border-border transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    onClick={() => setLocation(`/projects/${p.id}`)}
                    data-testid={`dashboard-project-row-${p.id}`}
                  >
                    <TableCell className="font-mono text-sm font-semibold text-primary py-3 px-4 border-x border-border first:border-r-0 last:border-l-0">{p.number}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate py-3 px-4 border-x border-border">{p.name}</TableCell>
                    <TableCell className="py-3 px-4 border-x border-border text-muted-foreground">{p.client}</TableCell>
                    <TableCell className="py-3 px-4 border-x border-border text-muted-foreground">{p.city}</TableCell>
                    <TableCell className="py-3 px-4 border-x border-border">
                      <span className="text-xs bg-secondary px-2 py-1 rounded-full text-secondary-foreground whitespace-nowrap">
                        {PROJECT_TYPES[p.projectType]}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4 border-x border-border text-muted-foreground whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell className="py-3 px-4 border-x border-border text-muted-foreground whitespace-nowrap">{new Date(p.updatedAt).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell className="py-3 px-4 border-x border-border last:border-l-0">
                      <Badge className={p.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
                        {p.status === 'active' ? 'نشط' : 'مكتمل'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t border-border flex justify-center">
            <Button variant="outline" asChild data-testid="dashboard-view-all-projects">
              <Link href="/projects">عرض جميع المشاريع</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-0">
          <CardTitle className="text-lg">أحدث المستندات</CardTitle>
          <Link href="/documents" className="text-sm text-primary hover:underline" data-testid="dashboard-view-all-docs">عرض الكل</Link>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border bg-muted/60">
                <TableHead className="text-right font-bold text-foreground py-3 px-4">رقم المستند</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">اسم المستند</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">النوع</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">المشروع</TableHead>
                <TableHead className="text-right font-bold text-foreground py-3 px-4">تاريخ الإضافة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((d, i) => {
                const proj = projects.find(p => p.id === d.projectId);
                return (
                  <TableRow key={d.id} className={`border-b border-border ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                    <TableCell className="font-mono text-sm font-semibold text-primary py-3 px-4">{d.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate py-3 px-4">{d.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="outline" className="text-xs bg-muted">{docTypeLabels[d.type] || d.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate py-3 px-4 text-muted-foreground">{proj?.name}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
