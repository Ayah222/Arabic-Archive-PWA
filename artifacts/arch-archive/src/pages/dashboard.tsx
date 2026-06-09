import React, { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { FolderKanban, CheckCircle2, Clock, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const { projects, documents } = useAppContext();
  const [, setLocation] = useLocation();

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const active = projects.filter(p => p.status === 'active').length;
    return { total, completed, active };
  }, [projects]);

  const recentProjects = projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const recentDocs = documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const barData = [
    { name: 'يناير', المشاريع: 12 },
    { name: 'فبراير', المشاريع: 19 },
    { name: 'مارس', المشاريع: 15 },
    { name: 'أبريل', المشاريع: 22 },
    { name: 'مايو', المشاريع: 18 },
    { name: 'يونيو', المشاريع: 24 },
  ];

  const pieData = [
    { name: 'مكتملة', value: stats.completed, color: '#2563EB' },
    { name: 'نشطة', value: stats.active, color: '#16A34A' },
  ];

  const docTypeLabels: Record<string, string> = {
    contract: 'عقد', quotation: 'عرض سعر', employee_data: 'بيانات موظف',
    report: 'تقرير', image: 'صورة', meeting: 'اجتماع', letter: 'خطاب',
    contractor: 'مقاول', drawing: 'مخطط'
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setLocation('/projects')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي المشاريع</p>
              <div className="flex items-end gap-2">
                <h3 className="text-2xl font-bold">{stats.total}</h3>
                <span className="text-xs text-green-600 font-medium mb-1">+5 هذا الشهر</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setLocation('/projects?status=completed')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">المشاريع المكتملة</p>
              <div className="flex items-end gap-2">
                <h3 className="text-2xl font-bold">{stats.completed}</h3>
                <span className="text-xs text-green-600 font-medium mb-1">+2 هذا الشهر</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setLocation('/projects?status=active')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">المشاريع النشطة</p>
              <div className="flex items-end gap-2">
                <h3 className="text-2xl font-bold">{stats.active}</h3>
                <span className="text-xs text-green-600 font-medium mb-1">+3 هذا الشهر</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">المشاريع المضافة (آخر 6 أشهر)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} dir="ltr">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="المشاريع" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">حالة المشاريع</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4 w-full justify-center">
              {pieData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">أحدث المشاريع</CardTitle>
            <Link href="/projects" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProjects.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/projects/${p.id}`)}>
                    <TableCell className="font-medium">{p.number}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{p.name}</TableCell>
                    <TableCell>{p.client}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className={p.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
                        {p.status === 'active' ? 'نشط' : 'مكتمل'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">أحدث المستندات</CardTitle>
            <Link href="/documents" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDocs.map(d => {
                  const proj = projects.find(p => p.id === d.projectId);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-xs font-mono">{d.number}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-muted">
                          {docTypeLabels[d.type] || d.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{proj?.name}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
