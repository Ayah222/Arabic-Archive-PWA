import React, { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { FolderKanban, CheckCircle2, Clock, FileText, ArrowUpRight } from 'lucide-react';
import { PROJECT_TYPES } from '../types';

/* ── Liquid Glass Card ── */
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  'data-testid'?: string;
}> = ({ children, className = '', accentColor = '#19D3A2', onClick, 'data-testid': testId }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-[1.015] hover:-translate-y-0.5' : ''} ${className}`}
      style={{
        background: isDark ? 'var(--glass-card-bg)' : 'var(--glass-card-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: `1px solid ${isDark ? 'var(--glass-card-border)' : 'rgba(255,255,255,0.80)'}`,
        boxShadow: isDark
          ? `var(--glass-inner-glow), var(--glass-drop-shadow), 0 0 0 1px ${accentColor}0A`
          : `var(--glass-inner-glow), var(--glass-drop-shadow), 0 0 0 1px ${accentColor}16`,
      }}
    >
      {/* Liquid top edge — accent tinted */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        background: isDark
          ? `linear-gradient(to right, transparent 8%, rgba(255,255,255,0.10) 25%, ${accentColor}80 48%, rgba(255,255,255,0.10) 72%, transparent 92%)`
          : `linear-gradient(to right, transparent 8%, rgba(255,255,255,0.95) 25%, ${accentColor}60 48%, rgba(255,255,255,0.95) 72%, transparent 92%)`,
        boxShadow: isDark ? `0 0 8px ${accentColor}35` : 'none',
      }}/>
      {/* Soft corner bloom — dark only */}
      {isDark && (
        <div style={{
          position:'absolute', top:-50, right:-50, width:140, height:140, borderRadius:'50%',
          background: accentColor, opacity:0.04, filter:'blur(40px)', pointerEvents:'none',
        }}/>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default function Dashboard() {
  const { projects, documents, theme } = useAppContext();
  const [, setLocation] = useLocation();
  const isDark = theme === 'dark';

  /* ── Adaptive text tokens ── */
  const c = {
    title:      isDark ? 'rgba(225,248,240,0.94)' : '#0a2922',
    body:       isDark ? 'rgba(210,245,235,0.86)' : '#0f3d34',
    secondary:  isDark ? 'rgba(160,220,205,0.70)' : '#1a5c50',
    muted:      isDark ? 'rgba(120,190,175,0.56)' : '#2e7a6c',
    numGreen:   isDark ? '#19D3A2'               : '#0c6b5f',
    numBlue:    isDark ? '#60a5fa'               : '#1d4ed8',
    numLime:    isDark ? '#a3e635'               : '#3f6212',
    numPurple:  isDark ? '#a78bfa'               : '#6d28d9',
    headGreen:  isDark ? 'rgba(25,211,162,0.80)' : '#0a6b5e',
    headBlue:   isDark ? 'rgba(96,165,250,0.80)' : '#1d4ed8',
    rowBorderG: isDark ? 'rgba(255,255,255,0.05)': 'rgba(13,118,106,0.10)',
    rowBorderB: isDark ? 'rgba(255,255,255,0.05)': 'rgba(29,78,216,0.08)',
    rowAlt:     isDark ? 'rgba(255,255,255,0.015)':'rgba(13,118,106,0.022)',
    rowHoverG:  isDark ? 'rgba(255,255,255,0.04)':'rgba(13,118,106,0.05)',
    rowHoverB:  isDark ? 'rgba(255,255,255,0.04)':'rgba(29,78,216,0.04)',
    headerBgG:  isDark ? 'rgba(25,211,162,0.04)' :'rgba(13,118,106,0.04)',
    headerBgB:  isDark ? 'rgba(96,165,250,0.04)' :'rgba(29,78,216,0.04)',
    tagGreenBg: isDark ? 'rgba(25,211,162,0.10)' :'rgba(13,118,106,0.08)',
    tagGreenTxt:isDark ? '#19D3A2'               :'#0a5c52',
    tagGreenBrd:isDark ? 'rgba(25,211,162,0.18)' :'rgba(13,118,106,0.20)',
    tagBlueBg:  isDark ? 'rgba(96,165,250,0.10)' :'rgba(29,78,216,0.07)',
    tagBlueTxt: isDark ? '#60a5fa'               :'#1e40af',
    tagBlueBrd: isDark ? 'rgba(96,165,250,0.18)' :'rgba(29,78,216,0.16)',
    btnGreen:   isDark ? 'rgba(25,211,162,0.80)' :'#0c6b5f',
    btnGreenBrd:isDark ? 'rgba(25,211,162,0.16)' :'rgba(13,118,106,0.24)',
    btnBlue:    isDark ? 'rgba(96,165,250,0.80)' :'#1d4ed8',
    btnBlueBrd: isDark ? 'rgba(96,165,250,0.16)' :'rgba(29,78,216,0.20)',
    badgeActive:isDark ? 'bg-emerald-500/15 text-emerald-400':'bg-emerald-600/10 text-emerald-800',
    badgeDone:  isDark ? 'bg-sky-500/15 text-sky-400'        :'bg-sky-600/10 text-sky-800',
  };

  const stats = useMemo(() => {
    const total     = projects.length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const active    = projects.filter(p => p.status === 'active').length;
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
    {
      label:'إجمالي المشاريع', value:stats.total, badge:'+5 هذا الشهر',
      icon:FolderKanban, testId:'kpi-total', onClick:() => setLocation('/projects'),
      accent: isDark ? '#19D3A2' : '#0d9488', numColor: c.numGreen,
      iconGrad: isDark
        ? 'linear-gradient(135deg, rgba(25,211,162,0.16) 0%, rgba(25,211,162,0.05) 100%)'
        : 'linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(13,148,136,0.04) 100%)',
    },
    {
      label:'المشاريع المكتملة', value:stats.completed, badge:'+2 هذا الشهر',
      icon:CheckCircle2, testId:'kpi-completed', onClick:() => setLocation('/projects?status=completed'),
      accent: isDark ? '#60a5fa' : '#3b82f6', numColor: c.numBlue,
      iconGrad: isDark
        ? 'linear-gradient(135deg, rgba(96,165,250,0.16) 0%, rgba(96,165,250,0.05) 100%)'
        : 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
    },
    {
      label:'المشاريع النشطة', value:stats.active, badge:'+3 هذا الشهر',
      icon:Clock, testId:'kpi-active', onClick:() => setLocation('/projects?status=active'),
      accent: isDark ? '#a3e635' : '#65a30d', numColor: c.numLime,
      iconGrad: isDark
        ? 'linear-gradient(135deg, rgba(163,230,53,0.16) 0%, rgba(163,230,53,0.05) 100%)'
        : 'linear-gradient(135deg, rgba(101,163,13,0.12) 0%, rgba(101,163,13,0.04) 100%)',
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <GlassCard key={kpi.testId} accentColor={kpi.accent} onClick={kpi.onClick} data-testid={kpi.testId}>
            <div className="p-6 flex items-center gap-4">
              <div className="rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  width: 52, height: 52,
                  background: kpi.iconGrad,
                  border: `1px solid ${kpi.accent}22`,
                  boxShadow: isDark
                    ? `var(--glass-inner-glow), 0 0 16px ${kpi.accent}1A`
                    : `0 2px 8px ${kpi.accent}18`,
                  color: kpi.accent,
                }}>
                <kpi.icon className="w-6 h-6"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1" style={{ color: c.muted }}>{kpi.label}</p>
                <h3 className="text-4xl font-black leading-none" data-testid={`${kpi.testId}-count`}
                  style={{ color: kpi.numColor, textShadow: isDark ? `0 0 24px ${kpi.accent}45` : 'none' }}>
                  {kpi.value}
                </h3>
                <span className="text-xs font-medium mt-1 block" style={{ color: isDark ? `${kpi.accent}88` : c.secondary }}>
                  {kpi.badge}
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 shrink-0 opacity-28" style={{ color: kpi.accent }}/>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Latest Projects ── */}
      <GlassCard accentColor={isDark ? '#19D3A2' : '#0d9488'}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: c.title }}>أحدث المشاريع</h2>
          <Button variant="ghost" size="sm" asChild className="text-xs rounded-lg h-7 px-3"
            style={{ color: c.btnGreen, border: `1px solid ${c.btnGreenBrd}` }}
            data-testid="dashboard-view-all-projects">
            <Link href="/projects">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${c.rowBorderG}`, background:c.headerBgG }}>
                {['رقم المشروع','اسم المشروع','العميل','المدينة','النوع','تاريخ الإنشاء','آخر تحديث','الحالة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-semibold"
                    style={{ color:c.headGreen }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((p, i) => (
                <TableRow key={p.id} className="cursor-pointer transition-colors duration-150"
                  style={{ borderBottom:`1px solid ${c.rowBorderG}`, background: i%2===0 ? 'transparent' : c.rowAlt }}
                  onMouseEnter={e => (e.currentTarget.style.background = c.rowHoverG)}
                  onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? 'transparent' : c.rowAlt)}
                  onClick={() => setLocation(`/projects/${p.id}`)}
                  data-testid={`dashboard-project-row-${p.id}`}
                >
                  <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color:c.numGreen }}>{p.number}</TableCell>
                  <TableCell className="font-semibold max-w-[200px] truncate py-3 px-4" style={{ color:c.body }}>{p.name}</TableCell>
                  <TableCell className="py-3 px-4" style={{ color:c.secondary }}>{p.client}</TableCell>
                  <TableCell className="py-3 px-4" style={{ color:c.secondary }}>{p.city}</TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background:c.tagGreenBg, color:c.tagGreenTxt, border:`1px solid ${c.tagGreenBrd}` }}>
                      {PROJECT_TYPES[p.projectType]}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 whitespace-nowrap text-sm" style={{ color:c.muted }}>{new Date(p.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell className="py-3 px-4 whitespace-nowrap text-sm" style={{ color:c.muted }}>{new Date(p.updatedAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge className={`text-xs font-semibold border-0 ${p.status === 'active' ? c.badgeActive : c.badgeDone}`}>
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
      <GlassCard accentColor={isDark ? '#60a5fa' : '#3b82f6'}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color:c.title }}>أحدث المستندات</h2>
          <Button variant="ghost" size="sm" asChild className="text-xs rounded-lg h-7 px-3"
            style={{ color:c.btnBlue, border:`1px solid ${c.btnBlueBrd}` }}
            data-testid="dashboard-view-all-docs-btn">
            <Link href="/documents">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${c.rowBorderB}`, background:c.headerBgB }}>
                {['رقم المستند','اسم المستند','النوع','المشروع','تاريخ الإضافة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-semibold"
                    style={{ color:c.headBlue }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((d, i) => {
                const proj = projects.find(p => p.id === d.projectId);
                return (
                  <TableRow key={d.id}
                    style={{ borderBottom:`1px solid ${c.rowBorderB}`, background: i%2===0 ? 'transparent' : c.rowAlt }}>
                    <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color:c.numBlue }}>{d.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate py-3 px-4 font-semibold" style={{ color:c.body }}>{d.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background:c.tagBlueBg, color:c.tagBlueTxt, border:`1px solid ${c.tagBlueBrd}` }}>
                        {docTypeLabels[d.type] || d.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate py-3 px-4" style={{ color:c.secondary }}>{proj?.name}</TableCell>
                    <TableCell className="py-3 px-4 whitespace-nowrap text-sm" style={{ color:c.muted }}>{new Date(d.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* ── Documents KPI ── */}
      <GlassCard accentColor={isDark ? '#a78bfa' : '#7c3aed'}>
        <div className="p-5 flex items-center gap-4">
          <div className="rounded-2xl flex items-center justify-center shrink-0"
            style={{
              width:52, height:52,
              background: isDark
                ? 'linear-gradient(135deg, rgba(167,139,250,0.16) 0%, rgba(167,139,250,0.05) 100%)'
                : 'linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0.03) 100%)',
              border: isDark ? '1px solid rgba(167,139,250,0.18)' : '1px solid rgba(124,58,237,0.15)',
              boxShadow: isDark ? 'var(--glass-inner-glow), 0 0 14px rgba(167,139,250,0.14)' : 'none',
              color: isDark ? '#a78bfa' : '#6d28d9',
            }}>
            <FileText className="w-6 h-6"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-1" style={{ color:c.muted }}>إجمالي المستندات</p>
            <h3 className="text-4xl font-black leading-none"
              style={{ color: isDark ? '#a78bfa' : '#6d28d9', textShadow: isDark ? '0 0 22px rgba(167,139,250,0.40)' : 'none' }}>
              {documents.length}
            </h3>
            <span className="text-xs font-medium mt-1 block" style={{ color: isDark ? 'rgba(167,139,250,0.72)':'#5b21b6' }}>
              +12 هذا الشهر
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 opacity-28" style={{ color: isDark ? '#a78bfa':'#6d28d9' }}/>
        </div>
      </GlassCard>

    </div>
  );
}
