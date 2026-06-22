import React, { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { FolderKanban, CheckCircle2, Clock, FileText, ArrowUpRight, AlertTriangle, Bell, Activity, CalendarClock, ShieldAlert } from 'lucide-react';
import { PROJECT_TYPES } from '../types';
import { mockContractors } from '../data/mockData';

/* ─────────────────────────────────────────
   GLASS CARD — vivid neon border + gradient
   ───────────────────────────────────────── */
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  accentGrad?: string;
  onClick?: () => void;
  'data-testid'?: string;
}> = ({ children, className = '', accentColor = '#00f0ff', accentGrad, onClick, 'data-testid': testId }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl transition-all duration-200
        ${onClick ? 'cursor-pointer hover:scale-[1.015] hover:-translate-y-0.5' : ''}
        ${className}`}
      style={{
        background: accentGrad ? `${accentGrad}, rgba(255,255,255,0.018)` : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.60)'),
        backdropFilter: 'blur(20px) saturate(200%)',
        WebkitBackdropFilter: 'blur(20px) saturate(200%)',
        /* Vivid neon border — key fix */
        border: isDark
          ? `1px solid ${accentColor}70`
          : `1px solid ${accentColor}55`,
        boxShadow: isDark
          ? `inset 0 1px 2px rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px ${accentColor}12, 0 0 25px ${accentColor}18`
          : `inset 0 1px 3px rgba(255,255,255,0.90), 0 10px 30px rgba(31,38,135,0.08), 0 0 0 1px ${accentColor}22`,
      }}>
      {/* Top chromatic glow edge */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        background: isDark
          ? `linear-gradient(to right, transparent 5%, ${accentColor}90 30%, rgba(255,255,255,0.25) 50%, ${accentColor}90 70%, transparent 95%)`
          : `linear-gradient(to right, transparent 5%, rgba(255,255,255,1) 25%, ${accentColor}70 50%, rgba(255,255,255,1) 75%, transparent 95%)`,
        boxShadow: isDark ? `0 0 12px ${accentColor}55` : 'none',
      }}/>
      {/* Corner ambient bloom */}
      {isDark && (
        <div style={{
          position:'absolute', top:-60, right:-60, width:160, height:160, borderRadius:'50%',
          background: accentColor, opacity:0.07, filter:'blur(45px)', pointerEvents:'none',
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

  const TODAY = new Date();

  /* ── Text tokens — high-contrast, no more washed-out ── */
  const c = {
    /* Primary headings */
    title:      isDark ? '#ffffff'              : '#1e1b4b',
    /* Body text */
    body:       isDark ? 'rgba(255,255,255,0.92)' : '#1e293b',
    /* Secondary text */
    secondary:  isDark ? 'rgba(255,255,255,0.72)' : '#334155',
    /* KPI labels — was too faint, now clearly visible */
    label:      isDark ? 'rgba(255,255,255,0.82)' : '#374151',
    /* Sub-line "+N هذا الشهر" */
    sub:        isDark ? 'rgba(255,255,255,0.55)' : '#6b7280',
    /* Table muted */
    muted:      isDark ? 'rgba(255,255,255,0.52)' : '#64748b',
    /* KPI numbers — neon */
    numCyan:    isDark ? '#00f0ff'               : '#0e7490',
    numPink:    isDark ? '#f472b6'               : '#be185d',
    numPurple:  isDark ? '#c084fc'               : '#6d28d9',
    numIndigo:  isDark ? '#818cf8'               : '#4338ca',
    /* Table headers */
    headCyan:   isDark ? 'rgba(0,240,255,0.85)'  : '#0e7490',
    headIndigo: isDark ? 'rgba(129,140,248,0.85)': '#4338ca',
    /* Row borders */
    rowBorderC: isDark ? 'rgba(0,240,255,0.08)'  : 'rgba(14,116,144,0.12)',
    rowBorderI: isDark ? 'rgba(129,140,248,0.08)': 'rgba(99,102,241,0.10)',
    rowAlt:     isDark ? 'rgba(255,255,255,0.018)': 'rgba(30,27,75,0.025)',
    rowHoverC:  isDark ? 'rgba(0,240,255,0.06)'  : 'rgba(6,182,212,0.05)',
    rowHoverI:  isDark ? 'rgba(129,140,248,0.06)': 'rgba(99,102,241,0.05)',
    hdrBgC:     isDark ? 'rgba(0,240,255,0.05)'  : 'rgba(6,182,212,0.04)',
    hdrBgI:     isDark ? 'rgba(129,140,248,0.05)': 'rgba(99,102,241,0.04)',
    /* Buttons */
    btnCyan:    isDark ? '#00f0ff'               : '#0e7490',
    btnCyanBrd: isDark ? 'rgba(0,240,255,0.30)'  : 'rgba(14,116,144,0.32)',
    btnIndigo:  isDark ? '#818cf8'               : '#4338ca',
    btnIndigoBrd:isDark ? 'rgba(129,140,248,0.30)': 'rgba(99,102,241,0.28)',
    /* Status badge vars */
    activeBg:   'var(--badge-active-bg)',
    activeBrd:  'var(--badge-active-border)',
    activeTxt:  'var(--badge-active-text)',
    doneBg:     'var(--badge-done-bg)',
    doneBrd:    'var(--badge-done-border)',
    doneTxt:    'var(--badge-done-text)',
  };

  const stats = useMemo(() => ({
    total:     projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    active:    projects.filter(p => p.status === 'active').length,
  }), [projects]);

  /* ── Smart Alerts ── */
  const alerts = useMemo(() => {
    const result: { level: 'danger' | 'warning' | 'info'; title: string; body: string; link?: string }[] = [];

    // Contractor registration alerts
    mockContractors.forEach(c => {
      if (!c.commercialRegistrationExpiry) return;
      const expiry = new Date(c.commercialRegistrationExpiry);
      const daysLeft = Math.ceil((expiry.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        result.push({ level: 'danger', title: 'سجل تجاري منتهي', body: `${c.name} — انتهى منذ ${Math.abs(daysLeft)} يوم`, link: `/contractors/${c.id}` });
      } else if (daysLeft <= 30) {
        result.push({ level: 'danger', title: 'سجل تجاري ينتهي قريباً', body: `${c.name} — ينتهي خلال ${daysLeft} يوم`, link: `/contractors/${c.id}` });
      } else if (daysLeft <= 90) {
        result.push({ level: 'warning', title: 'سجل تجاري يقترب من الانتهاء', body: `${c.name} — ينتهي خلال ${daysLeft} يوم`, link: `/contractors/${c.id}` });
      }
    });

    // Active project end-date alerts
    projects.filter(p => p.status === 'active' && p.endDate).forEach(p => {
      const endDate = new Date(p.endDate!);
      const daysLeft = Math.ceil((endDate.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        result.push({ level: 'danger', title: 'تأخر في إنجاز المشروع', body: `${p.name} — تجاوز الموعد بـ ${Math.abs(daysLeft)} يوم`, link: `/projects/${p.id}` });
      } else if (daysLeft <= 60) {
        result.push({ level: 'warning', title: 'اقتراب موعد تسليم مشروع', body: `${p.name} — يتبقى ${daysLeft} يوم`, link: `/projects/${p.id}` });
      }
    });

    return result.slice(0, 5);
  }, [projects]);

  /* ── Activity Feed ── */
  const activities = useMemo(() => {
    const docActivities = [...documents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map(d => {
        const proj = projects.find(p => p.id === d.projectId);
        const typeLabels: Record<string, string> = {
          contract:'عقد', quotation:'عرض سعر', report:'تقرير',
          image:'صورة', meeting:'اجتماع', letter:'خطاب',
          contractor:'مقاول', drawing:'مخطط', employee_data:'بيانات موظف',
        };
        return {
          id: d.id,
          icon: 'doc',
          text: `إضافة ${typeLabels[d.type] || d.type}: ${d.name}`,
          sub: proj?.name || '',
          date: d.createdAt,
        };
      });
    return docActivities;
  }, [documents, projects]);

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

  /* ── Project type pill ── */
  const typePill = (key: string) => {
    const dark: Record<string, { bg:string; text:string; border:string }> = {
      residential:    { bg:'rgba(0,240,255,0.10)',   text:'#00f0ff', border:'rgba(0,240,255,0.35)'   },
      commercial:     { bg:'rgba(255,0,128,0.10)',   text:'#ff4da6', border:'rgba(255,0,128,0.35)'   },
      industrial:     { bg:'rgba(0,240,255,0.10)',   text:'#22d3ee', border:'rgba(6,182,212,0.32)'   },
      hospitality:    { bg:'rgba(251,146,60,0.10)',  text:'#fb923c', border:'rgba(251,146,60,0.32)'  },
      educational:    { bg:'rgba(129,140,248,0.10)', text:'#818cf8', border:'rgba(129,140,248,0.32)' },
      governmental:   { bg:'rgba(192,132,252,0.10)', text:'#c084fc', border:'rgba(192,132,252,0.32)' },
      healthcare:     { bg:'rgba(52,211,153,0.10)',  text:'#34d399', border:'rgba(52,211,153,0.32)'  },
      infrastructure: { bg:'rgba(251,191,36,0.10)',  text:'#fbbf24', border:'rgba(251,191,36,0.32)'  },
      mixed:          { bg:'rgba(167,139,250,0.10)', text:'#a78bfa', border:'rgba(167,139,250,0.32)' },
      environmental:  { bg:'rgba(45,212,191,0.10)',  text:'#2dd4bf', border:'rgba(45,212,191,0.32)'  },
    };
    const light: Record<string, { bg:string; text:string; border:string }> = {
      residential:    { bg:'rgba(6,182,212,0.10)',  text:'#0e7490', border:'rgba(6,182,212,0.30)'   },
      commercial:     { bg:'rgba(236,72,153,0.10)', text:'#be185d', border:'rgba(236,72,153,0.30)'  },
      industrial:     { bg:'rgba(6,182,212,0.09)',  text:'#0e7490', border:'rgba(6,182,212,0.26)'   },
      hospitality:    { bg:'rgba(249,115,22,0.09)', text:'#c2410c', border:'rgba(249,115,22,0.26)'  },
      educational:    { bg:'rgba(99,102,241,0.09)', text:'#4338ca', border:'rgba(99,102,241,0.26)'  },
      governmental:   { bg:'rgba(168,85,247,0.09)', text:'#6d28d9', border:'rgba(168,85,247,0.26)'  },
      healthcare:     { bg:'rgba(16,185,129,0.09)', text:'#065f46', border:'rgba(16,185,129,0.26)'  },
      infrastructure: { bg:'rgba(202,138,4,0.09)',  text:'#92400e', border:'rgba(202,138,4,0.26)'   },
      mixed:          { bg:'rgba(124,58,237,0.09)', text:'#5b21b6', border:'rgba(124,58,237,0.26)'  },
      environmental:  { bg:'rgba(13,148,136,0.09)', text:'#134e4a', border:'rgba(13,148,136,0.26)'  },
    };
    const fallback = { bg:'rgba(148,163,184,0.09)', text: isDark ? '#94a3b8':'#475569', border:'rgba(148,163,184,0.22)' };
    return isDark ? (dark[key] ?? fallback) : (light[key] ?? fallback);
  };

  /* ── KPI cards — original order: total → completed → active ── */
  const kpis = [
    {
      label:'إجمالي المشاريع',   value:stats.total,     sub:'+5 هذا الشهر',
      icon:FolderKanban, testId:'kpi-total',
      onClick: () => setLocation('/projects'),
      accent: isDark ? '#c084fc' : '#7c3aed',
      grad: isDark
        ? 'linear-gradient(135deg, rgba(147,51,234,0.28) 0%, rgba(6,182,212,0.05) 100%)'
        : 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(6,182,212,0.04) 100%)',
      numColor: isDark ? '#c084fc' : '#6d28d9',
    },
    {
      label:'المشاريع المكتملة', value:stats.completed, sub:'+2 هذا الشهر',
      icon:CheckCircle2, testId:'kpi-completed',
      onClick: () => setLocation('/projects?status=completed'),
      accent: isDark ? '#f472b6' : '#be185d',
      grad: isDark
        ? 'linear-gradient(135deg, rgba(255,0,128,0.26) 0%, rgba(112,0,255,0.06) 100%)'
        : 'linear-gradient(135deg, rgba(236,72,153,0.18) 0%, rgba(99,102,241,0.04) 100%)',
      numColor: isDark ? '#f472b6' : '#be185d',
    },
    {
      label:'المشاريع النشطة',   value:stats.active,    sub:'+3 هذا الشهر',
      icon:Clock, testId:'kpi-active',
      onClick: () => setLocation('/projects?status=active'),
      accent: isDark ? '#00f0ff' : '#0e7490',
      grad: isDark
        ? 'linear-gradient(135deg, rgba(0,240,255,0.26) 0%, rgba(112,0,255,0.06) 100%)'
        : 'linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(147,51,234,0.04) 100%)',
      numColor: isDark ? '#00f0ff' : '#0e7490',
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <GlassCard key={kpi.testId} accentColor={kpi.accent} accentGrad={kpi.grad}
            onClick={kpi.onClick} data-testid={kpi.testId}>
            <div className="p-6 flex items-center gap-4">
              <div className="rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  width:52, height:52,
                  background: isDark ? `${kpi.accent}14` : `${kpi.accent}11`,
                  border: `1px solid ${kpi.accent}40`,
                  boxShadow: isDark ? `0 0 18px ${kpi.accent}20, inset 0 1px 1px rgba(255,255,255,0.08)` : 'none',
                  color: kpi.accent,
                }}>
                <kpi.icon className="w-6 h-6"/>
              </div>
              <div className="flex-1 min-w-0">
                {/* Label — was too faint, now rgba(255,255,255,0.82) */}
                <p className="text-sm font-semibold mb-1" style={{ color: c.label }}>{kpi.label}</p>
                <h3 className="text-4xl font-black leading-none"
                  data-testid={`${kpi.testId}-count`}
                  style={{
                    color: kpi.numColor,
                    textShadow: isDark ? `0 0 28px ${kpi.accent}60, 0 0 6px ${kpi.accent}40` : 'none',
                  }}>
                  {kpi.value}
                </h3>
                <span className="text-xs font-medium mt-1 block" style={{ color: c.sub }}>{kpi.sub}</span>
              </div>
              <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: kpi.accent, opacity:0.50 }}/>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Smart Alerts ── */}
      {alerts.length > 0 && (
        <GlassCard accentColor={isDark ? '#f472b6' : '#be185d'}
          accentGrad={isDark
            ? 'linear-gradient(135deg, rgba(239,68,68,0.20) 0%, rgba(251,191,36,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(251,191,36,0.04) 100%)'}>
          <div className="p-5 pb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" style={{ color: isDark ? '#f472b6' : '#be185d' }} />
            <h2 className="text-base font-bold flex-1" style={{ color: c.title }}>تنبيهات النظام</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.10)', color: isDark ? '#f87171' : '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}>
              {alerts.length}
            </span>
          </div>
          <div className="px-5 pb-4 space-y-2">
            {alerts.map((a, i) => {
              const danger = a.level === 'danger';
              const alertColor = danger ? (isDark ? '#f87171' : '#dc2626') : (isDark ? '#fbbf24' : '#d97706');
              const alertBg   = danger ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)') : (isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)');
              const alertBrd  = danger ? (isDark ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.18)') : (isDark ? 'rgba(251,191,36,0.22)' : 'rgba(251,191,36,0.18)');
              const Icon = danger ? ShieldAlert : AlertTriangle;
              return (
                <div key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl ${a.link ? 'cursor-pointer hover:opacity-80' : ''}`}
                  style={{ background: alertBg, border: `1px solid ${alertBrd}` }}
                  onClick={() => a.link && setLocation(a.link)}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: alertColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold" style={{ color: alertColor }}>{a.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: c.secondary }}>{a.body}</p>
                  </div>
                  {a.link && <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: alertColor, opacity: 0.60 }} />}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ── Latest Projects ── */}
      <GlassCard accentColor={isDark ? '#00f0ff' : '#0e7490'}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: c.title }}>أحدث المشاريع</h2>
          <Button variant="ghost" size="sm" asChild className="text-xs rounded-xl h-7 px-3 font-bold"
            style={{ color: c.btnCyan, border: `1px solid ${c.btnCyanBrd}`,
              background: isDark ? 'rgba(0,240,255,0.06)':'rgba(14,116,144,0.06)' }}
            data-testid="dashboard-view-all-projects">
            <Link href="/projects">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${c.rowBorderC}`, background:c.hdrBgC }}>
                {['رقم المشروع','اسم المشروع','العميل','المدينة','النوع','تاريخ الإنشاء','آخر تحديث','الحالة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold"
                    style={{ color: c.headCyan }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((p, i) => {
                const pill = typePill(p.projectType);
                return (
                  <TableRow key={p.id} className="cursor-pointer transition-colors duration-150"
                    style={{ borderBottom:`1px solid ${c.rowBorderC}`, background: i%2===0 ? 'transparent' : c.rowAlt }}
                    onMouseEnter={e => (e.currentTarget.style.background = c.rowHoverC)}
                    onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? 'transparent' : c.rowAlt)}
                    onClick={() => setLocation(`/projects/${p.id}`)}
                    data-testid={`dashboard-project-row-${p.id}`}>
                    <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color: c.numCyan }}>{p.number}</TableCell>
                    <TableCell className="font-bold max-w-[200px] truncate py-3 px-4" style={{ color: c.body }}>{p.name}</TableCell>
                    <TableCell className="py-3 px-4 text-sm" style={{ color: c.secondary }}>{p.client}</TableCell>
                    <TableCell className="py-3 px-4 text-sm" style={{ color: c.secondary }}>{p.city}</TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                        style={{ background: pill.bg, color: pill.text, border:`1px solid ${pill.border}` }}>
                        {PROJECT_TYPES[p.projectType]}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4 whitespace-nowrap text-sm font-medium" style={{ color: c.muted }}>
                      {new Date(p.createdAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                    <TableCell className="py-3 px-4 whitespace-nowrap text-sm font-medium" style={{ color: c.muted }}>
                      {new Date(p.updatedAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                        style={p.status === 'active'
                          ? { background: c.activeBg, color: c.activeTxt, border: c.activeBrd }
                          : { background: c.doneBg,   color: c.doneTxt,   border: c.doneBrd }}>
                        {p.status === 'active' ? 'نشط' : 'مكتمل'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* ── Recent Documents ── */}
      <GlassCard accentColor={isDark ? '#818cf8' : '#4338ca'}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: c.title }}>أحدث المستندات</h2>
          <Button variant="ghost" size="sm" asChild className="text-xs rounded-xl h-7 px-3 font-bold"
            style={{ color: c.btnIndigo, border: `1px solid ${c.btnIndigoBrd}`,
              background: isDark ? 'rgba(129,140,248,0.06)':'rgba(99,102,241,0.06)' }}
            data-testid="dashboard-view-all-docs-btn">
            <Link href="/documents">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${c.rowBorderI}`, background:c.hdrBgI }}>
                {['رقم المستند','اسم المستند','النوع','المشروع','تاريخ الإضافة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold"
                    style={{ color: c.headIndigo }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((d, i) => {
                const proj = projects.find(p => p.id === d.projectId);
                return (
                  <TableRow key={d.id}
                    style={{ borderBottom:`1px solid ${c.rowBorderI}`, background: i%2===0 ? 'transparent' : c.rowAlt }}>
                    <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color: c.numIndigo }}>{d.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate py-3 px-4 font-bold" style={{ color: c.body }}>{d.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                        style={{
                          background: isDark ? 'rgba(129,140,248,0.12)':'rgba(99,102,241,0.09)',
                          color: isDark ? '#818cf8':'#4338ca',
                          border: `1px solid ${isDark ? 'rgba(129,140,248,0.32)':'rgba(99,102,241,0.26)'}`,
                        }}>
                        {docTypeLabels[d.type] || d.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate py-3 px-4 font-medium" style={{ color: c.secondary }}>{proj?.name}</TableCell>
                    <TableCell className="py-3 px-4 whitespace-nowrap text-sm font-medium" style={{ color: c.muted }}>
                      {new Date(d.createdAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* ── Activity Feed ── */}
      <GlassCard accentColor={isDark ? '#c084fc' : '#7c3aed'}
        accentGrad={isDark
          ? 'linear-gradient(135deg, rgba(192,132,252,0.14) 0%, rgba(0,240,255,0.03) 100%)'
          : 'linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(99,102,241,0.03) 100%)'}>
        <div className="p-5 pb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: isDark ? '#c084fc' : '#7c3aed' }} />
          <h2 className="text-base font-bold" style={{ color: c.title }}>آخر النشاطات</h2>
        </div>
        <div className="px-5 pb-4 space-y-0">
          {activities.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: c.muted }}>لا توجد نشاطات حديثة</p>
          ) : (
            activities.map((a, i) => (
              <div key={a.id}
                className="flex items-start gap-3 py-2.5"
                style={{ borderBottom: i < activities.length - 1 ? (isDark ? '1px solid rgba(192,132,252,0.07)' : '1px solid rgba(168,85,247,0.08)') : 'none' }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isDark ? 'rgba(192,132,252,0.10)' : 'rgba(168,85,247,0.08)',
                    border: isDark ? '1px solid rgba(192,132,252,0.20)' : '1px solid rgba(168,85,247,0.18)',
                  }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: isDark ? '#c084fc' : '#7c3aed' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: c.body }}>{a.text}</p>
                  {a.sub && <p className="text-xs mt-0.5 truncate" style={{ color: c.muted }}>{a.sub}</p>}
                </div>
                <span className="text-xs whitespace-nowrap shrink-0 mt-0.5" style={{ color: c.muted }}>
                  {new Date(a.date).toLocaleDateString('ar-SA')}
                </span>
              </div>
            ))
          )}
        </div>
      </GlassCard>

    </div>
  );
}
