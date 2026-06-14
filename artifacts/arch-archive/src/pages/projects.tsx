import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { ProjectStatus, ProjectType, PROJECT_TYPES, CITIES } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Search, Grid, List as ListIcon, Plus, Calendar, User, MapPin, ArrowUpRight } from 'lucide-react';
import AddProjectDialog from '../components/projects/AddProjectDialog';

type SortOrder = 'newest' | 'oldest' | 'updated';

/* ─────────────────────────────────
   Hover-only neon card wrapper
   ───────────────────────────────── */
function NeonCard({
  children, accent = '#00f0ff', selected = false, onClick, className = '', isDark,
  'data-testid': testId,
}: {
  children: React.ReactNode; accent?: string; selected?: boolean;
  onClick?: () => void; className?: string; isDark: boolean;
  'data-testid'?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const lit = hovered || selected;
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.024)' : 'rgba(255,255,255,0.68)',
        backdropFilter: 'blur(20px) saturate(200%)',
        WebkitBackdropFilter: 'blur(20px) saturate(200%)',
        border: lit
          ? `1px solid ${accent}65`
          : isDark ? `1px solid ${accent}18` : `1px solid ${accent}28`,
        boxShadow: lit
          ? isDark
            ? `inset 0 1px 2px rgba(255,255,255,0.10), 0 0 22px ${accent}20, 0 12px 40px rgba(0,0,0,0.55)`
            : `inset 0 1px 3px rgba(255,255,255,0.90), 0 0 18px ${accent}16, 0 10px 30px rgba(31,38,135,0.09)`
          : isDark
            ? 'inset 0 1px 2px rgba(255,255,255,0.06), 0 6px 20px rgba(0,0,0,0.42)'
            : 'inset 0 1px 3px rgba(255,255,255,0.80), 0 4px 14px rgba(31,38,135,0.05)',
        transform: hovered && onClick ? 'translateY(-2px)' : 'translateY(0)',
      }}>
      {/* Top liquid edge */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        background: isDark
          ? `linear-gradient(to right, transparent 5%, ${accent}${lit ? '80' : '30'} 40%, rgba(255,255,255,${lit ? '0.20' : '0.08'}) 50%, ${accent}${lit ? '80' : '30'} 60%, transparent 95%)`
          : `linear-gradient(to right, transparent 5%, rgba(255,255,255,0.95) 25%, ${accent}${lit ? '55' : '30'} 50%, rgba(255,255,255,0.95) 75%, transparent 95%)`,
        transition: 'all 0.2s ease',
      }}/>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function Projects() {
  const { projects, theme } = useAppContext();
  const [, setLocation] = useLocation();
  const isDark = theme === 'dark';

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

  /* ── Text tokens ── */
  const c = {
    title:     isDark ? '#ffffff'               : '#1e1b4b',
    body:      isDark ? 'rgba(255,255,255,0.92)': '#1e293b',
    secondary: isDark ? 'rgba(255,255,255,0.72)': '#334155',
    label:     isDark ? 'rgba(255,255,255,0.82)': '#374151',
    muted:     isDark ? 'rgba(255,255,255,0.50)': '#64748b',
    numCyan:   isDark ? '#00f0ff'               : '#0e7490',
    headCyan:  isDark ? 'rgba(0,240,255,0.85)'  : '#0e7490',
    rowBorder: isDark ? 'rgba(0,240,255,0.07)'  : 'rgba(14,116,144,0.10)',
    rowHover:  isDark ? 'rgba(0,240,255,0.05)'  : 'rgba(6,182,212,0.05)',
    rowAlt:    isDark ? 'rgba(255,255,255,0.015)': 'rgba(30,27,75,0.025)',
    hdrBg:     isDark ? 'rgba(0,240,255,0.04)'  : 'rgba(6,182,212,0.04)',
    activeBg:  'var(--badge-active-bg)',
    activeBrd: 'var(--badge-active-border)',
    activeTxt: 'var(--badge-active-text)',
    doneBg:    'var(--badge-done-bg)',
    doneBrd:   'var(--badge-done-border)',
    doneTxt:   'var(--badge-done-text)',
  };

  /* ── Type pill ── */
  const typePill = (key: string) => {
    const dark: Record<string, {bg:string;text:string;border:string}> = {
      residential:  {bg:'rgba(0,240,255,0.10)',  text:'#00f0ff', border:'rgba(0,240,255,0.35)'},
      commercial:   {bg:'rgba(255,0,128,0.10)',  text:'#ff4da6', border:'rgba(255,0,128,0.35)'},
      industrial:   {bg:'rgba(6,182,212,0.10)',  text:'#22d3ee', border:'rgba(6,182,212,0.32)'},
      hospitality:  {bg:'rgba(251,146,60,0.10)', text:'#fb923c', border:'rgba(251,146,60,0.32)'},
      educational:  {bg:'rgba(129,140,248,0.10)',text:'#818cf8', border:'rgba(129,140,248,0.32)'},
      governmental: {bg:'rgba(192,132,252,0.10)',text:'#c084fc', border:'rgba(192,132,252,0.32)'},
      healthcare:   {bg:'rgba(52,211,153,0.10)', text:'#34d399', border:'rgba(52,211,153,0.32)'},
      infrastructure:{bg:'rgba(251,191,36,0.10)',text:'#fbbf24', border:'rgba(251,191,36,0.32)'},
      mixed:        {bg:'rgba(167,139,250,0.10)',text:'#a78bfa', border:'rgba(167,139,250,0.32)'},
      environmental:{bg:'rgba(45,212,191,0.10)', text:'#2dd4bf', border:'rgba(45,212,191,0.32)'},
    };
    const light: Record<string, {bg:string;text:string;border:string}> = {
      residential:  {bg:'rgba(6,182,212,0.10)',  text:'#0e7490', border:'rgba(6,182,212,0.28)'},
      commercial:   {bg:'rgba(236,72,153,0.10)', text:'#be185d', border:'rgba(236,72,153,0.28)'},
      industrial:   {bg:'rgba(6,182,212,0.09)',  text:'#0e7490', border:'rgba(6,182,212,0.24)'},
      hospitality:  {bg:'rgba(249,115,22,0.09)', text:'#c2410c', border:'rgba(249,115,22,0.24)'},
      educational:  {bg:'rgba(99,102,241,0.09)', text:'#4338ca', border:'rgba(99,102,241,0.24)'},
      governmental: {bg:'rgba(168,85,247,0.09)', text:'#6d28d9', border:'rgba(168,85,247,0.24)'},
      healthcare:   {bg:'rgba(16,185,129,0.09)', text:'#065f46', border:'rgba(16,185,129,0.24)'},
      infrastructure:{bg:'rgba(202,138,4,0.09)', text:'#92400e', border:'rgba(202,138,4,0.24)'},
      mixed:        {bg:'rgba(124,58,237,0.09)', text:'#5b21b6', border:'rgba(124,58,237,0.24)'},
      environmental:{bg:'rgba(13,148,136,0.09)', text:'#134e4a', border:'rgba(13,148,136,0.24)'},
    };
    const fallback = {bg:'rgba(148,163,184,0.09)', text:isDark?'#94a3b8':'#475569', border:'rgba(148,163,184,0.20)'};
    return isDark ? (dark[key]??fallback) : (light[key]??fallback);
  };

  /* ── Shared input/select style ── */
  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.80)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(99,102,241,0.18)',
    color: isDark ? 'rgba(255,255,255,0.88)' : '#1e1b4b',
    borderRadius: 10, padding: '8px 12px', fontSize: 14, outline: 'none',
    backdropFilter: 'blur(8px)',
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold" style={{ color: c.title }}>المشاريع</h1>
        <button
          onClick={() => setIsAddDialogOpen(true)}
          data-testid="button-add-project"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-[0.97]"
          style={{
            background: isDark ? 'linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)' : 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
            color: '#fff',
            boxShadow: isDark ? 'inset 0 1px 1px rgba(255,255,255,0.25), 0 0 22px rgba(0,240,255,0.35)' : '0 4px 14px rgba(99,102,241,0.38)',
            border: isDark ? '1px solid rgba(0,240,255,0.25)' : '1px solid rgba(99,102,241,0.28)',
          }}>
          <Plus className="w-4 h-4" />
          إضافة مشروع جديد
        </button>
      </div>

      {/* ── Filter panel ── */}
      <NeonCard accent={isDark ? '#818cf8' : '#6366f1'} isDark={isDark}>
        <div className="p-4 space-y-4">
          {/* Row 1: Search + Sort + View */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: c.muted }}/>
              <input
                placeholder="البحث في المشاريع..."
                className="w-full h-10 pr-9 rounded-xl text-sm transition-all outline-none"
                style={{ ...inputStyle, paddingRight: 36 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search-projects"
              />
            </div>
            <div className="flex gap-2 items-center">
              <select style={inputStyle} value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} data-testid="select-sort-projects">
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
                <option value="updated">آخر تحديث</option>
              </select>
              {/* View toggle */}
              <div className="flex rounded-xl overflow-hidden"
                style={{ border: isDark ? '1px solid rgba(129,140,248,0.25)' : '1px solid rgba(99,102,241,0.22)', background: isDark ? 'rgba(129,140,248,0.06)' : 'rgba(99,102,241,0.06)' }}>
                {([['grid', Grid, 'button-view-grid'], ['table', ListIcon, 'button-view-table']] as [string, React.ElementType, string][]).map(([mode, Icon, tid]) => (
                  <button key={mode} data-testid={tid}
                    onClick={() => setViewMode(mode as 'grid'|'table')}
                    className="w-10 h-10 flex items-center justify-center transition-all duration-150"
                    style={viewMode === mode ? {
                      background: isDark ? 'rgba(129,140,248,0.20)' : 'rgba(99,102,241,0.14)',
                      color: isDark ? '#818cf8' : '#4338ca',
                    } : { color: c.muted }}>
                    <Icon className="w-4 h-4"/>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Row 2: Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'حالة المشروع', val:statusFilter, testId:'select-filter-status', opts:[['all','الكل'],['active','نشط'],['completed','مكتمل']], onChange:(v:string)=>setStatusFilter(v as ProjectStatus|'all') },
              { label:'المدينة', val:cityFilter, testId:'select-filter-city', opts:[['all','كل المدن'],...CITIES.map(c=>[c,c])], onChange:(v:string)=>setCityFilter(v) },
              { label:'نوع المشروع', val:typeFilter, testId:'select-filter-type', opts:[['all','كل الأنواع'],...Object.entries(PROJECT_TYPES).map(([k,v])=>[k,v])], onChange:(v:string)=>setTypeFilter(v as ProjectType|'all') },
              { label:'العميل', val:clientFilter, testId:'select-filter-client', opts:[['all','كل العملاء'],...uniqueClients.map(c=>[c,c])], onChange:(v:string)=>setClientFilter(v) },
            ].map(f => (
              <div key={f.label} className="space-y-1">
                <label className="text-xs font-medium" style={{ color: c.muted }}>{f.label}</label>
                <select style={{ ...inputStyle, width:'100%' }} value={f.val} data-testid={f.testId} onChange={e=>f.onChange(e.target.value)}>
                  {f.opts.map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="text-sm font-medium" style={{ color: c.muted }}>
            {filteredProjects.length} مشروع من أصل {projects.length}
          </p>
        </div>
      </NeonCard>

      {/* ── Grid View ── */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map(project => {
            const pill = typePill(project.projectType);
            return (
              <NeonCard
                key={project.id}
                accent={isDark ? '#00f0ff' : '#0e7490'}
                isDark={isDark}
                onClick={() => setLocation(`/projects/${project.id}`)}
                data-testid={`card-project-${project.id}`}
              >
                {/* Cover image */}
                <div className="h-40 overflow-hidden relative">
                  <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                  {/* Status badge */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                      style={project.status === 'active'
                        ? { background: c.activeBg, color: c.activeTxt, border: c.activeBrd }
                        : { background: c.doneBg,   color: c.doneTxt,   border: c.doneBrd }}>
                      {project.status === 'active' ? 'نشط' : 'مكتمل'}
                    </span>
                  </div>
                  {/* Number overlay */}
                  <div className="absolute bottom-2.5 left-2.5">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.55)', color: isDark ? '#00f0ff' : '#22d3ee', backdropFilter:'blur(6px)' }}>
                      {project.number}
                    </span>
                  </div>
                </div>
                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: pill.bg, color: pill.text, border:`1px solid ${pill.border}` }}>
                      {PROJECT_TYPES[project.projectType]}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-30" style={{ color: isDark ? '#00f0ff' : '#0e7490' }}/>
                  </div>
                  <h3 className="font-bold text-sm mb-3 line-clamp-2 leading-snug" style={{ color: c.body }}>{project.name}</h3>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { icon: User,     val: project.client },
                      { icon: MapPin,   val: project.city   },
                      { icon: Calendar, val: new Date(project.createdAt).toLocaleDateString('ar-SA') },
                    ].map(({ icon: Icon, val }) => (
                      <div key={val} className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 shrink-0" style={{ color: isDark ? 'rgba(0,240,255,0.55)' : '#6d28d9', opacity: 0.75 }}/>
                        <span className="truncate" style={{ color: c.secondary }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </NeonCard>
            );
          })}
          {filteredProjects.length === 0 && (
            <div className="col-span-full text-center py-16" style={{ color: c.muted }}>
              لا توجد مشاريع تطابق معايير البحث
            </div>
          )}
        </div>
      ) : (
        /* ── Table View ── */
        <NeonCard accent={isDark ? '#00f0ff' : '#0e7490'} isDark={isDark}>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderBottom:`1px solid ${c.rowBorder}`, background: c.hdrBg }}>
                  <TableHead className="w-16 text-right py-3 px-3"/>
                  {['رقم المشروع','اسم المشروع','العميل','المدينة','نوع المشروع','تاريخ الإنشاء','آخر تحديث','الحالة'].map(h => (
                    <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold" style={{ color: c.headCyan }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project, i) => {
                  const pill = typePill(project.projectType);
                  return (
                    <TableRow key={project.id}
                      className="cursor-pointer transition-colors duration-150"
                      style={{ borderBottom:`1px solid ${c.rowBorder}`, background: i%2===0 ? 'transparent' : c.rowAlt }}
                      onMouseEnter={e => (e.currentTarget.style.background = c.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? 'transparent' : c.rowAlt)}
                      onClick={() => setLocation(`/projects/${project.id}`)}
                      data-testid={`row-project-${project.id}`}>
                      <TableCell className="py-3 px-3">
                        <div className="w-12 h-8 rounded-lg overflow-hidden" style={{ border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
                          <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover"/>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color: c.numCyan }}>{project.number}</TableCell>
                      <TableCell className="font-bold max-w-[180px] truncate py-3 px-4" style={{ color: c.body }}>{project.name}</TableCell>
                      <TableCell className="py-3 px-4 text-sm" style={{ color: c.secondary }}>{project.client}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="flex items-center gap-1 text-sm" style={{ color: c.secondary }}>
                          <MapPin className="w-3 h-3 opacity-60"/>{project.city}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: pill.bg, color: pill.text, border:`1px solid ${pill.border}` }}>
                          {PROJECT_TYPES[project.projectType]}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-sm font-medium whitespace-nowrap" style={{ color: c.muted }}>
                        {new Date(project.createdAt).toLocaleDateString('ar-SA')}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-sm font-medium whitespace-nowrap" style={{ color: c.muted }}>
                        {new Date(project.updatedAt).toLocaleDateString('ar-SA')}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                          style={project.status === 'active'
                            ? { background: c.activeBg, color: c.activeTxt, border: c.activeBrd }
                            : { background: c.doneBg,   color: c.doneTxt,   border: c.doneBrd }}>
                          {project.status === 'active' ? 'نشط' : 'مكتمل'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12" style={{ color: c.muted }}>
                      لا توجد مشاريع تطابق معايير البحث
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </NeonCard>
      )}

      <AddProjectDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}/>
    </div>
  );
}
