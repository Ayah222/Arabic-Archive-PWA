import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { ProjectStatus, ProjectType, PROJECT_TYPES, CITIES } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Grid, List as ListIcon, Plus, Calendar, User, MapPin, Building2 } from 'lucide-react';
import AddProjectDialog from '../components/projects/AddProjectDialog';

type SortOrder = 'newest' | 'oldest' | 'updated';

export default function Projects() {
  const { projects } = useAppContext();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get('status') as ProjectStatus | 'all' || 'all';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(initialStatus);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const uniqueClients = useMemo(() => Array.from(new Set(projects.map(p => p.client))).sort(), [projects]);

  const filteredProjects = useMemo(() => projects
    .filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (cityFilter !== 'all' && p.city !== cityFilter) return false;
      if (typeFilter !== 'all' && p.projectType !== typeFilter) return false;
      if (clientFilter !== 'all' && p.client !== clientFilter) return false;
      if (search && !p.name.includes(search) && !p.number.includes(search) && !p.client.includes(search) && !p.city.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }), [projects, search, statusFilter, cityFilter, typeFilter, clientFilter, sortOrder]);

  const selectClass = "h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">المشاريع</h1>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2" data-testid="button-add-project">
          <Plus className="w-4 h-4" />
          إضافة مشروع جديد
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Row 1: Search + Sort + View Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="البحث في المشاريع..."
                className="pr-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search-projects"
              />
            </div>
            <div className="flex gap-2 items-center">
              <select
                className={selectClass}
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as SortOrder)}
                data-testid="select-sort-projects"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
                <option value="updated">آخر تحديث</option>
              </select>
              <div className="flex border border-input rounded-md overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  className="rounded-none h-10 w-10"
                  onClick={() => setViewMode('grid')}
                  data-testid="button-view-grid"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="icon"
                  className="rounded-none h-10 w-10"
                  onClick={() => setViewMode('table')}
                  data-testid="button-view-table"
                >
                  <ListIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Row 2: Advanced Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">حالة المشروع</label>
              <select
                className={`${selectClass} w-full`}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                data-testid="select-filter-status"
              >
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="completed">مكتمل</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">المدينة</label>
              <select
                className={`${selectClass} w-full`}
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                data-testid="select-filter-city"
              >
                <option value="all">كل المدن</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">نوع المشروع</label>
              <select
                className={`${selectClass} w-full`}
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as ProjectType | 'all')}
                data-testid="select-filter-type"
              >
                <option value="all">كل الأنواع</option>
                {(Object.entries(PROJECT_TYPES) as [ProjectType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">العميل</label>
              <select
                className={`${selectClass} w-full`}
                value={clientFilter}
                onChange={e => setClientFilter(e.target.value)}
                data-testid="select-filter-client"
              >
                <option value="all">كل العملاء</option>
                {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {filteredProjects.length} مشروع من أصل {projects.length}
          </p>
        </CardContent>
      </Card>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProjects.map(project => (
            <Card
              key={project.id}
              className="cursor-pointer hover:border-primary transition-all hover:shadow-md overflow-hidden group"
              onClick={() => setLocation(`/projects/${project.id}`)}
              data-testid={`card-project-${project.id}`}
            >
              <div className="h-40 overflow-hidden relative">
                <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute top-2 right-2">
                  <Badge className={project.status === 'active' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}>
                    {project.status === 'active' ? 'نشط' : 'مكتمل'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{project.number}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">{PROJECT_TYPES[project.projectType]}</span>
                </div>
                <h3 className="font-bold text-base mb-3 line-clamp-2 leading-snug">{project.name}</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{project.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{project.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{new Date(project.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProjects.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              لا توجد مشاريع تطابق معايير البحث
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border bg-muted/60 sticky top-0">
                  <TableHead className="w-16 text-right font-bold text-foreground py-3 px-3"></TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">رقم المشروع</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4">اسم المشروع</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">العميل</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">المدينة</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">نوع المشروع</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">تاريخ الإنشاء</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">آخر تحديث</TableHead>
                  <TableHead className="text-right font-bold text-foreground py-3 px-4 whitespace-nowrap">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project, i) => (
                  <TableRow
                    key={project.id}
                    className={`cursor-pointer hover:bg-primary/5 border-b border-border transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    onClick={() => setLocation(`/projects/${project.id}`)}
                    data-testid={`row-project-${project.id}`}
                  >
                    <TableCell className="py-3 px-3">
                      <div className="w-12 h-8 rounded overflow-hidden border border-border">
                        <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-primary py-3 px-4">{project.number}</TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate py-3 px-4">{project.name}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap">{project.client}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {project.city}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs bg-secondary px-2 py-1 rounded-full text-secondary-foreground whitespace-nowrap">
                        {PROJECT_TYPES[project.projectType]}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(project.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(project.updatedAt).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge className={project.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
                        {project.status === 'active' ? 'نشط' : 'مكتمل'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      لا توجد مشاريع تطابق معايير البحث
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AddProjectDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </div>
  );
}
