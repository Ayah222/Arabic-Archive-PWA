import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Project, ProjectStatus } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Grid, List as ListIcon, Plus, Calendar, User, Clock } from 'lucide-react';
import AddProjectDialog from '../components/projects/AddProjectDialog';

export default function Projects() {
  const { projects } = useAppContext();
  const [, setLocation] = useLocation();
  
  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get('status') as ProjectStatus | 'all' || 'all';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(initialStatus);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const filteredProjects = projects
    .filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search && !p.name.includes(search) && !p.number.includes(search) && !p.client.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">المشاريع</h1>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة مشروع جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row gap-4 justify-between">
            <div className="flex-1 flex gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  placeholder="البحث في المشاريع..." 
                  className="pr-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex bg-secondary p-1 rounded-md">
                <button
                  className={`px-4 py-1.5 text-sm rounded-sm transition-colors ${statusFilter === 'all' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                  onClick={() => setStatusFilter('all')}
                >الكل</button>
                <button
                  className={`px-4 py-1.5 text-sm rounded-sm transition-colors ${statusFilter === 'active' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                  onClick={() => setStatusFilter('active')}
                >نشط</button>
                <button
                  className={`px-4 py-1.5 text-sm rounded-sm transition-colors ${statusFilter === 'completed' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                  onClick={() => setStatusFilter('completed')}
                >مكتمل</button>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <select 
                className="h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>

              <div className="flex border rounded-md overflow-hidden">
                <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-none h-10 w-10" onClick={() => setViewMode('grid')}>
                  <Grid className="w-4 h-4" />
                </Button>
                <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="rounded-none h-10 w-10" onClick={() => setViewMode('table')}>
                  <ListIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.map(project => (
            <Card key={project.id} className="cursor-pointer hover:border-primary transition-all hover:shadow-md overflow-hidden group" onClick={() => setLocation(`/projects/${project.id}`)}>
              <div className="h-40 overflow-hidden relative">
                <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Badge className={project.status === 'active' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}>
                    {project.status === 'active' ? 'نشط' : 'مكتمل'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="text-xs font-mono text-muted-foreground mb-2">{project.number}</div>
                <h3 className="font-bold text-lg mb-4 line-clamp-1">{project.name}</h3>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 shrink-0" />
                    <span className="truncate">{project.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>{new Date(project.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20"></TableHead>
                <TableHead className="text-right">رقم المشروع</TableHead>
                <TableHead className="text-right">اسم المشروع</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                <TableHead className="text-right">آخر تحديث</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map(project => (
                <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/projects/${project.id}`)}>
                  <TableCell>
                    <div className="w-12 h-8 rounded overflow-hidden">
                      <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{project.number}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{project.name}</TableCell>
                  <TableCell>{project.client}</TableCell>
                  <TableCell>{new Date(project.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell>{new Date(project.updatedAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className={project.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
                      {project.status === 'active' ? 'نشط' : 'مكتمل'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddProjectDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  );
}
