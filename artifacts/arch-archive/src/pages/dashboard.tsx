import React, { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { FolderKanban, CheckCircle2, Clock, FileText, ArrowUpRight } from 'lucide-react';
import { PROJECT_TYPES } from '../types';

/* ── Glass card shell ── */
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  'data-testid'?: string;
}> = ({ children, className = '', accentColor = '#00d483', onClick, 'data-testid': testId }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''} ${className}`}
      style={isDark ? {
        background: 'rgba(10, 24, 17, 0.72)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(0,212,131,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04)',
      } : {
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${accentColor}30`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.07), 0 1px 0 ${accentColor}20`,
      }}
    >
      {/* Top accent edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: isDark ? 1 : 2,
        background: `linear-gradient(to right, transparent 5%, ${accentColor}${isDark ? '90' : '80'} 35%, ${accentColor}${isDark ? 'CC' : 'BB'} 50%, ${accentColor}${isDark ? '90' : '80'} 65%, transparent 95%)`,
        boxShadow: isDark ? `0 0 8px ${accentColor}60` : 'none',
      }}/>
      {isDark && <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', background:accentColor, opacity:0.06, filter:'blur(30px)', pointerEvents:'none' }}/>}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default function Dashboard() {
  const { projects, documents, theme } = useAppContext();
  const [, setLocation] = useLocation();
  const isDark = theme === 'dark';

  /* ── Adaptive colour tokens ── */
  const c = {
    title:       isDark ? 'rgba(215,248,232,0.93)' : '#0f2d1f',
    body:        isDark ? 'rgba(220,245,235,0.88)' : '#1a3a28',
    secondary:   isDark ? 'rgba(170,220,195,0.72)' : '#2d5a40',
    muted:       isDark ? 'rgba(140,200,170,0.60)' : '#4a7a5e',
    headGreen:   isDark ? 'rgba(0,212,131,0.78)'   : '#007a4c',
    headBlue:    isDark ? 'rgba(56,189,248,0.78)'  : '#0369a1',
    rowHover:    isDark ? 'rgba(0,212,131,0.06)'   : 'rgba(0,154,96,0.05)',
    rowAlt:      isDark ? 'rgba(0,212,131,0.02)'   : 'rgba(0,154,96,0.025)',
    rowBorder:   isDark ? 'rgba(0,212,131,0.07)'   : 'rgba(0,154,96,0.10)',
    headerBgG:   isDark ? 'rgba(0,212,131,0.05)'   : 'rgba(0,154,96,0.06)',
    headerBgB:   isDark ? 'rgba(56,189,248,0.05)'  : 'rgba(3,105,161,0.05)',
    headerBrdG:  isDark ? 'rgba(0,212,131,0.12)'   : 'rgba(0,154,96,0.18)',
    headerBrdB:  isDark ? 'rgba(56,189,248,0.12)'  : 'rgba(3,105,161,0.18)',
    tagGreenBg:  isDark ? 'rgba(0,212,131,0.10)'   : 'rgba(0,154,96,0.09)',
    tagGreenTxt: isDark ? 'rgba(0,212,131,0.90)'   : '#006636',
    tagGreenBrd: isDark ? 'rgba(0,212,131,0.18)'   : 'rgba(0,154,96,0.25)',
    tagBlueBg:   isDark ? 'rgba(56,189,248,0.10)'  : 'rgba(3,105,161,0.09)',
    tagBlueTxt:  isDark ? 'rgba(56,189,248,0.90)'  : '#0369a1',
    tagBlueBrd:  isDark ? 'rgba(56,189,248,0.18)'  : 'rgba(3,105,161,0.25)',
    btnGreen:    isDark ? 'rgba(0,212,131,0.82)'   : '#00874a',
    btnGreenBrd: isDark ? 'rgba(0,212,131,0.18)'   : 'rgba(0,154,96,0.28)',
    btnBlue:     isDark ? 'rgba(56,189,248,0.82)'  : '#0369a1',
    btnBlueBrd:  isDark ? 'rgba(56,189,248,0.18)'  : 'rgba(3,105,161,0.28)',
  };

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
    contract:'عقد', quotation:'عرض سعر', employee_data:'بيانات موظف',
    report:'تقرير', image:'صورة', meeting:'اجتماع', letter:'خطاب',
    contractor:'مقاول', drawing:'مخطط',
  };

  const kpis = [
    { label:'إجمالي المشاريع',  value:stats.total,     badge:'+5 هذا الشهر', icon:FolderKanban,  testId:'kpi-total',     onClick:() => setLocation('/projects'),                    accent:'#00a862', iconGrad:'linear-gradient(135deg, rgba(0,168,98,0.18) 0%, rgba(0,168,98,0.08) 100%)' },
    { label:'المشاريع المكتملة', value:stats.completed, badge:'+2 هذا الشهر', icon:CheckCircle2,  testId:'kpi-completed', onClick:() => setLocation('/projects?status=completed'),   accent:'#0284c7', iconGrad:'linear-gradient(135deg, rgba(2,132,199,0.18) 0%, rgba(2,132,199,0.08) 100%)' },
    { label:'المشاريع النشطة',   value:stats.active,    badge:'+3 هذا الشهر', icon:Clock,         testId:'kpi-active',    onClick:() => setLocation('/projects?status=active'),      accent:'#65a30d', iconGrad:'linear-gradient(135deg, rgba(101,163,13,0.18) 0%, rgba(101,163,13,0.08) 100%)' },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <GlassCard key={kpi.testId} accentColor={kpi.accent} onClick={kpi.onClick} data-testid={kpi.testId}>
            <div className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background:kpi.iconGrad, border:`1px solid ${kpi.accent}35`, boxShadow:`0 0 16px ${kpi.accent}22`, color:kpi.accent }}>
                <kpi.icon className="w-7 h-7"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1" style={{ color:c.muted }}>{kpi.label}</p>
                <h3 className="text-4xl font-black" data-testid={`${kpi.testId}-count`}
                  style={{ color:kpi.accent, textShadow: isDark ? `0 0 20px ${kpi.accent}55` : 'none' }}>
                  {kpi.value}
                </h3>
                <span className="text-xs font-semibold mt-0.5 block" style={{ color:`${kpi.accent}BB` }}>{kpi.badge}</span>
              </div>
              <ArrowUpRight className="w-4 h-4 shrink-0 opacity-40" style={{ color:kpi.accent }}/>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Latest Projects ── */}
      <GlassCard accentColor="#00a862">
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color:c.headGreen }}>✦</span>
            <h2 className="text-base font-bold" style={{ color:c.title }}>أحدث المشاريع</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs rounded-lg h-7 px-3"
            style={{ color:c.btnGreen, border:`1px solid ${c.btnGreenBrd}` }}
            data-testid="dashboard-view-all-projects">
            <Link href="/projects">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${c.headerBrdG}`, background:c.headerBgG }}>
                {['رقم المشروع','اسم المشروع','العميل','المدينة','النوع','تاريخ الإنشاء','آخر تحديث','الحالة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold tracking-wide"
                    style={{ color:c.headGreen }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((p, i) => (
                <TableRow key={p.id} className="cursor-pointer transition-colors"
                  style={{ borderBottom:`1px solid ${c.rowBorder}`, background: i%2===0 ? 'transparent' : c.rowAlt }}
                  onMouseEnter={e => (e.currentTarget.style.background = c.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? 'transparent' : c.rowAlt)}
                  onClick={() => setLocation(`/projects/${p.id}`)}
                  data-testid={`dashboard-project-row-${p.id}`}
                >
                  <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color:'#00a862' }}>{p.number}</TableCell>
                  <TableCell className="font-semibold max-w-[200px] truncate py-3 px-4" style={{ color:c.body }}>{p.name}</TableCell>
                  <TableCell className="py-3 px-4" style={{ color:c.secondary }}>{p.client}</TableCell>
                  <TableCell className="py-3 px-4" style={{ color:c.secondary }}>{p.city}</TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background:c.tagGreenBg, color:c.tagGreenTxt, border:`1px solid ${c.tagGreenBrd}` }}>
                      {PROJECT_TYPES[p.projectType]}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 whitespace-nowrap" style={{ color:c.muted }}>{new Date(p.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell className="py-3 px-4 whitespace-nowrap" style={{ color:c.muted }}>{new Date(p.updatedAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge className={`text-xs font-semibold border-0 ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-sky-500/15 text-sky-700 dark:text-sky-400'}`}>
                      {p.status === 'active' ? 'نشط' : 'مكتمل'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* ── Recent Documents ── */}
      <GlassCard accentColor="#0284c7">
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color:c.headBlue }}>✦</span>
            <h2 className="text-base font-bold" style={{ color:c.title }}>أحدث المستندات</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs rounded-lg h-7 px-3"
            style={{ color:c.btnBlue, border:`1px solid ${c.btnBlueBrd}` }}
            data-testid="dashboard-view-all-docs-btn">
            <Link href="/documents">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${c.headerBrdB}`, background:c.headerBgB }}>
                {['رقم المستند','اسم المستند','النوع','المشروع','تاريخ الإضافة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold tracking-wide"
                    style={{ color:c.headBlue }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((d, i) => {
                const proj = projects.find(p => p.id === d.projectId);
                return (
                  <TableRow key={d.id}
                    style={{ borderBottom:`1px solid ${c.headerBrdB}`, background: i%2===0 ? 'transparent' : c.rowAlt }}>
                    <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color:'#0284c7' }}>{d.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate py-3 px-4 font-semibold" style={{ color:c.body }}>{d.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background:c.tagBlueBg, color:c.tagBlueTxt, border:`1px solid ${c.tagBlueBrd}` }}>
                        {docTypeLabels[d.type] || d.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate py-3 px-4" style={{ color:c.secondary }}>{proj?.name}</TableCell>
                    <TableCell className="py-3 px-4 whitespace-nowrap" style={{ color:c.muted }}>{new Date(d.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* ── Documents KPI ── */}
      <GlassCard accentColor="#7c3aed">
        <div className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background:'linear-gradient(135deg,rgba(124,58,237,0.18) 0%,rgba(124,58,237,0.08) 100%)', border:'1px solid rgba(124,58,237,0.28)', boxShadow: isDark ? '0 0 20px rgba(124,58,237,0.22)' : 'none', color:'#7c3aed' }}>
            <FileText className="w-7 h-7"/>
          </div>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color:c.muted }}>إجمالي المستندات</p>
            <h3 className="text-4xl font-black" style={{ color:'#7c3aed', textShadow: isDark ? '0 0 20px rgba(124,58,237,0.45)' : 'none' }}>
              {documents.length}
            </h3>
            <span className="text-xs font-semibold mt-0.5 block" style={{ color:'rgba(124,58,237,0.75)' }}>+12 هذا الشهر</span>
          </div>
          <ArrowUpRight className="w-4 h-4 mr-auto opacity-40" style={{ color:'#7c3aed' }}/>
        </div>
      </GlassCard>

    </div>
  );
}
