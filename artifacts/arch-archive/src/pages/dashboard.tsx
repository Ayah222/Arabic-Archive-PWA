import React, { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Clock, CheckSquare, FolderOpen, FileText, ArrowUpRight } from 'lucide-react';
import { PROJECT_TYPES } from '../types';

/* ─────────────────────────────────────────
   KPI GLASS CARD — matches reference images
   ───────────────────────────────────────── */
type CardVariant = 'cyan' | 'pink' | 'purple';

const variantTokens = {
  cyan: {
    /* dark */
    darkGrad:   'linear-gradient(135deg, rgba(0,240,255,0.22) 0%, rgba(112,0,255,0.06) 100%)',
    darkBorder: 'rgba(0,240,255,0.30)',
    darkNum:    '#00f0ff',
    darkGlow:   '0 0 28px rgba(0,240,255,0.35), 0 0 60px rgba(0,240,255,0.12)',
    darkIcon:   'rgba(0,240,255,0.14)',
    darkIconBrd:'rgba(0,240,255,0.30)',
    darkIconClr:'#00f0ff',
    /* light */
    lightGrad:  'linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(147,51,234,0.04) 100%)',
    lightBorder:'rgba(6,182,212,0.35)',
    lightNum:   '#0891b2',
    lightGlow:  '0 4px 20px rgba(6,182,212,0.22)',
    lightIcon:  'rgba(6,182,212,0.12)',
    lightIconBrd:'rgba(6,182,212,0.28)',
    lightIconClr:'#0891b2',
  },
  pink: {
    darkGrad:   'linear-gradient(135deg, rgba(255,0,128,0.22) 0%, rgba(112,0,255,0.06) 100%)',
    darkBorder: 'rgba(255,0,128,0.30)',
    darkNum:    '#ff4da6',
    darkGlow:   '0 0 28px rgba(255,0,128,0.32), 0 0 60px rgba(255,0,128,0.10)',
    darkIcon:   'rgba(255,0,128,0.14)',
    darkIconBrd:'rgba(255,0,128,0.30)',
    darkIconClr:'#ff4da6',
    lightGrad:  'linear-gradient(135deg, rgba(236,72,153,0.18) 0%, rgba(99,102,241,0.04) 100%)',
    lightBorder:'rgba(236,72,153,0.32)',
    lightNum:   '#db2777',
    lightGlow:  '0 4px 20px rgba(236,72,153,0.22)',
    lightIcon:  'rgba(236,72,153,0.12)',
    lightIconBrd:'rgba(236,72,153,0.28)',
    lightIconClr:'#db2777',
  },
  purple: {
    darkGrad:   'linear-gradient(135deg, rgba(147,51,234,0.24) 0%, rgba(6,182,212,0.06) 100%)',
    darkBorder: 'rgba(147,51,234,0.30)',
    darkNum:    '#c084fc',
    darkGlow:   '0 0 28px rgba(147,51,234,0.35), 0 0 60px rgba(147,51,234,0.12)',
    darkIcon:   'rgba(147,51,234,0.16)',
    darkIconBrd:'rgba(147,51,234,0.32)',
    darkIconClr:'#c084fc',
    lightGrad:  'linear-gradient(135deg, rgba(168,85,247,0.16) 0%, rgba(6,182,212,0.04) 100%)',
    lightBorder:'rgba(168,85,247,0.32)',
    lightNum:   '#7c3aed',
    lightGlow:  '0 4px 20px rgba(168,85,247,0.22)',
    lightIcon:  'rgba(168,85,247,0.12)',
    lightIconBrd:'rgba(168,85,247,0.28)',
    lightIconClr:'#7c3aed',
  },
};

const KpiCard: React.FC<{
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  variant: CardVariant;
  isDark: boolean;
  onClick?: () => void;
  testId?: string;
}> = ({ label, value, sub, icon: Icon, variant, isDark, onClick, testId }) => {
  const t = variantTokens[variant];
  const grad      = isDark ? t.darkGrad      : t.lightGrad;
  const border    = isDark ? t.darkBorder    : t.lightBorder;
  const numColor  = isDark ? t.darkNum       : t.lightNum;
  const glow      = isDark ? t.darkGlow      : t.lightGlow;
  const iconBg    = isDark ? t.darkIcon      : t.lightIcon;
  const iconBrd   = isDark ? t.darkIconBrd   : t.lightIconBrd;
  const iconClr   = isDark ? t.darkIconClr   : t.lightIconClr;

  return (
    <div data-testid={testId} onClick={onClick}
      className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 select-none`}
      style={{
        background: `${grad}, var(--glass-card-bg)`,
        border: `1px solid ${border}`,
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: isDark
          ? `inset 0 1px 2px rgba(255,255,255,0.12), ${glow}, 0 12px 40px rgba(0,0,0,0.52)`
          : `inset 0 1px 3px rgba(255,255,255,0.85), ${glow}`,
      }}>

      {/* Inner top highlight */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        background: isDark
          ? `linear-gradient(to right, transparent 8%, ${border} 35%, rgba(255,255,255,0.18) 50%, ${border} 65%, transparent 92%)`
          : `linear-gradient(to right, transparent 8%, rgba(255,255,255,0.95) 50%, transparent 92%)`,
      }}/>

      {/* Corner glow bloom */}
      {isDark && (
        <div style={{
          position:'absolute', top:-60, right:-60, width:180, height:180, borderRadius:'50%',
          background: numColor, opacity:0.08, filter:'blur(50px)', pointerEvents:'none',
        }}/>
      )}

      {/* Arrow indicator */}
      <div style={{ position:'absolute', top:14, right:14, color: numColor, opacity:0.70 }}>
        <ArrowUpRight className="w-4 h-4"/>
      </div>

      <div className="p-5 pt-6 pb-5 relative z-10">
        {/* Label */}
        <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)' }}>
          {label}
        </p>

        <div className="flex items-end justify-between gap-3">
          {/* Number */}
          <div>
            <h3 className="text-5xl font-black leading-none mb-1"
              data-testid={testId ? `${testId}-count` : undefined}
              style={{
                color: numColor,
                textShadow: isDark ? `0 0 30px ${numColor}70, 0 0 8px ${numColor}50` : 'none',
                fontVariantNumeric: 'tabular-nums',
              }}>
              {value}
            </h3>
            <span className="text-[11px] font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.42)' }}>
              {sub}
            </span>
          </div>

          {/* Icon */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: iconBg,
              border: `1px solid ${iconBrd}`,
              boxShadow: isDark ? `inset 0 1px 1px rgba(255,255,255,0.08), 0 0 14px ${numColor}22` : 'none',
              color: iconClr,
            }}>
            <Icon className="w-5 h-5"/>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   GLASS TABLE CARD
   ───────────────────────────────────────── */
const GlassTable: React.FC<{ children: React.ReactNode; isDark: boolean; accentColor?: string }> = ({ children, isDark, accentColor = '#00f0ff' }) => (
  <div className="relative overflow-hidden rounded-2xl"
    style={{
      background: isDark ? 'rgba(255,255,255,0.024)' : 'rgba(255,255,255,0.52)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.72)'}`,
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      boxShadow: isDark
        ? `inset 0 1px 2px rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.50), 0 0 0 1px ${accentColor}08`
        : `inset 0 1px 3px rgba(255,255,255,0.85), 0 10px 30px rgba(31,38,135,0.06)`,
    }}>
    <div style={{
      position:'absolute', top:0, left:0, right:0, height:1,
      background: isDark
        ? `linear-gradient(to right, transparent 5%, rgba(0,240,255,0.16) 35%, rgba(112,0,255,0.12) 65%, transparent 95%)`
        : 'rgba(255,255,255,0.92)',
    }}/>
    <div className="relative z-10">{children}</div>
  </div>
);

/* ── Project type pill colors ── */
const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  residential:   { bg:'rgba(6,182,212,0.12)',  text:'#06b6d4', border:'rgba(6,182,212,0.30)' },
  commercial:    { bg:'rgba(236,72,153,0.12)', text:'#ec4899', border:'rgba(236,72,153,0.30)' },
  industrial:    { bg:'rgba(6,182,212,0.12)',  text:'#22d3ee', border:'rgba(6,182,212,0.28)' },
  hospitality:   { bg:'rgba(251,146,60,0.12)', text:'#fb923c', border:'rgba(251,146,60,0.28)' },
  educational:   { bg:'rgba(99,102,241,0.12)', text:'#818cf8', border:'rgba(99,102,241,0.28)' },
  governmental:  { bg:'rgba(168,85,247,0.12)', text:'#c084fc', border:'rgba(168,85,247,0.28)' },
  healthcare:    { bg:'rgba(34,197,94,0.12)',  text:'#4ade80', border:'rgba(34,197,94,0.28)'  },
  infrastructure:{ bg:'rgba(234,179,8,0.12)',  text:'#eab308', border:'rgba(234,179,8,0.28)'  },
  mixed:         { bg:'rgba(147,51,234,0.12)', text:'#a855f7', border:'rgba(147,51,234,0.28)' },
  environmental: { bg:'rgba(20,184,166,0.12)', text:'#14b8a6', border:'rgba(20,184,166,0.28)' },
};

const defaultTypeColor = { bg:'rgba(148,163,184,0.10)', text:'#94a3b8', border:'rgba(148,163,184,0.22)' };

/* ── Light-mode overrides (more saturated pastels) ── */
const typeColorsLight: Record<string, { bg: string; text: string; border: string }> = {
  residential:   { bg:'rgba(6,182,212,0.10)',  text:'#0891b2', border:'rgba(6,182,212,0.28)'  },
  commercial:    { bg:'rgba(236,72,153,0.10)', text:'#db2777', border:'rgba(236,72,153,0.28)' },
  industrial:    { bg:'rgba(6,182,212,0.10)',  text:'#0891b2', border:'rgba(6,182,212,0.25)'  },
  hospitality:   { bg:'rgba(249,115,22,0.10)', text:'#ea580c', border:'rgba(249,115,22,0.26)' },
  educational:   { bg:'rgba(99,102,241,0.10)', text:'#4f46e5', border:'rgba(99,102,241,0.26)' },
  governmental:  { bg:'rgba(168,85,247,0.10)', text:'#7c3aed', border:'rgba(168,85,247,0.26)' },
  healthcare:    { bg:'rgba(22,163,74,0.10)',  text:'#16a34a', border:'rgba(22,163,74,0.26)'  },
  infrastructure:{ bg:'rgba(202,138,4,0.10)',  text:'#b45309', border:'rgba(202,138,4,0.26)'  },
  mixed:         { bg:'rgba(124,58,237,0.10)', text:'#6d28d9', border:'rgba(124,58,237,0.26)' },
  environmental: { bg:'rgba(13,148,136,0.10)', text:'#0f766e', border:'rgba(13,148,136,0.26)' },
};

export default function Dashboard() {
  const { projects, documents, theme } = useAppContext();
  const [, setLocation] = useLocation();
  const isDark = theme === 'dark';

  const typeColor = (key: string) =>
    isDark ? (typeColors[key] ?? defaultTypeColor) : (typeColorsLight[key] ?? { bg:'rgba(100,116,139,0.08)', text:'#475569', border:'rgba(100,116,139,0.20)' });

  const stats = useMemo(() => ({
    total:     projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    active:    projects.filter(p => p.status === 'active').length,
  }), [projects]);

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  /* ── Badge style: active (cyan) / completed (pink) ── */
  const statusBadge = (status: string) =>
    status === 'active'
      ? { bg: 'var(--badge-active-bg)', border: 'var(--badge-active-border)', color: 'var(--badge-active-text)' }
      : { bg: 'var(--badge-done-bg)',   border: 'var(--badge-done-border)',   color: 'var(--badge-done-text)'   };

  /* ── Text tokens ── */
  const txt = {
    primary:   isDark ? '#ffffff'           : '#0f172a',
    body:      isDark ? 'rgba(255,255,255,0.85)' : '#1e293b',
    secondary: isDark ? 'rgba(255,255,255,0.60)' : '#475569',
    muted:     isDark ? 'rgba(255,255,255,0.38)' : '#64748b',
    tHead:     isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
    rowBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,41,59,0.07)',
    rowAlt:    isDark ? 'rgba(255,255,255,0.015)':'rgba(30,41,59,0.025)',
    rowHover:  isDark ? 'rgba(0,240,255,0.04)'   :'rgba(99,102,241,0.04)',
    numCyan:   isDark ? '#00f0ff' : '#0891b2',
    numBlue:   isDark ? '#818cf8' : '#4f46e5',
    hdrCyan:   isDark ? 'rgba(0,240,255,0.70)'  : '#0891b2',
    hdrBlue:   isDark ? 'rgba(129,140,248,0.70)': '#4f46e5',
    hdrBgCyan: isDark ? 'rgba(0,240,255,0.04)'  : 'rgba(6,182,212,0.04)',
    hdrBgBlue: isDark ? 'rgba(129,140,248,0.04)': 'rgba(99,102,241,0.04)',
    btnCyan:   isDark ? 'rgba(0,240,255,0.80)'  : '#0891b2',
    btnCyanBrd:isDark ? 'rgba(0,240,255,0.18)'  : 'rgba(6,182,212,0.28)',
    btnBlue:   isDark ? 'rgba(129,140,248,0.80)': '#4f46e5',
    btnBlueBrd:isDark ? 'rgba(129,140,248,0.18)': 'rgba(99,102,241,0.24)',
  };

  const docTypeLabels: Record<string, string> = {
    contract:'عقد', quotation:'عرض سعر', employee_data:'بيانات موظف',
    report:'تقرير', image:'صورة', meeting:'اجتماع', letter:'خطاب',
    contractor:'مقاول', drawing:'مخطط',
  };

  return (
    <div className="space-y-4 md:space-y-5">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <KpiCard
          testId="kpi-active" label="المشاريع النشطة" value={stats.active}
          sub="+3 هذا الشهر" icon={Clock} variant="cyan" isDark={isDark}
          onClick={() => setLocation('/projects?status=active')}
        />
        <KpiCard
          testId="kpi-completed" label="المشاريع المكتملة" value={stats.completed}
          sub="+2 هذا الشهر" icon={CheckSquare} variant="pink" isDark={isDark}
          onClick={() => setLocation('/projects?status=completed')}
        />
        <KpiCard
          testId="kpi-total" label="إجمالي المشاريع" value={stats.total}
          sub="+5 هذا الشهر" icon={FolderOpen} variant="purple" isDark={isDark}
          onClick={() => setLocation('/projects')}
        />
      </div>

      {/* ── Latest Projects Table ── */}
      <GlassTable isDark={isDark} accentColor="#00f0ff">
        <div className="px-4 md:px-5 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base md:text-lg font-bold" style={{ color: txt.primary }}>أحدث المشاريع</h2>
          <Button variant="ghost" size="sm" asChild
            className="text-xs rounded-xl h-8 px-4 font-semibold"
            style={{ color: txt.btnCyan, border: `1px solid ${txt.btnCyanBrd}`,
              background: isDark ? 'rgba(0,240,255,0.05)':'rgba(6,182,212,0.06)' }}
            data-testid="dashboard-view-all-projects">
            <Link href="/projects">عرض الكل</Link>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom:`1px solid ${txt.rowBorder}`, background: txt.hdrBgCyan }}>
                {['رقم المشروع','اسم المشروع','العميل','المدينة','النوع','تاريخ الإنشاء','آخر تحديث','الحالة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-2.5 px-3 md:px-4 text-xs font-semibold"
                    style={{ color: txt.hdrCyan }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((p, i) => {
                const badge = statusBadge(p.status);
                const tc = typeColor(p.projectType);
                return (
                  <TableRow key={p.id}
                    className="cursor-pointer transition-colors duration-150"
                    style={{ borderBottom:`1px solid ${txt.rowBorder}`, background: i%2===0 ? 'transparent' : txt.rowAlt }}
                    onMouseEnter={e => (e.currentTarget.style.background = txt.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? 'transparent' : txt.rowAlt)}
                    onClick={() => setLocation(`/projects/${p.id}`)}
                    data-testid={`dashboard-project-row-${p.id}`}>
                    <TableCell className="font-mono text-xs md:text-sm font-bold py-2.5 px-3 md:px-4 whitespace-nowrap"
                      style={{ color: txt.numCyan }}>{p.number}</TableCell>
                    <TableCell className="font-semibold text-xs md:text-sm max-w-[160px] md:max-w-[200px] truncate py-2.5 px-3 md:px-4"
                      style={{ color: txt.body }}>{p.name}</TableCell>
                    <TableCell className="text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap" style={{ color: txt.secondary }}>{p.client}</TableCell>
                    <TableCell className="text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap" style={{ color: txt.secondary }}>{p.city}</TableCell>
                    <TableCell className="py-2.5 px-3 md:px-4">
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap"
                        style={{ background: tc.bg, color: tc.text, border:`1px solid ${tc.border}` }}>
                        {PROJECT_TYPES[p.projectType]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-2.5 px-3 md:px-4 whitespace-nowrap" style={{ color: txt.muted }}>
                      {new Date(p.createdAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                    <TableCell className="text-xs py-2.5 px-3 md:px-4 whitespace-nowrap" style={{ color: txt.muted }}>
                      {new Date(p.updatedAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 md:px-4">
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
                        style={{ background: badge.bg, color: badge.color, border: badge.border }}>
                        {p.status === 'active' ? 'نشط' : 'مكتمل'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassTable>

      {/* ── Bottom row: Recent Docs + Doc KPI ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent Documents */}
        <div className="xl:col-span-2">
          <GlassTable isDark={isDark} accentColor="#818cf8">
            <div className="px-4 md:px-5 pt-4 pb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold" style={{ color: txt.primary }}>أحدث المستندات</h2>
              <Button variant="ghost" size="sm" asChild
                className="text-xs rounded-xl h-8 px-4 font-semibold"
                style={{ color: txt.btnBlue, border: `1px solid ${txt.btnBlueBrd}`,
                  background: isDark ? 'rgba(129,140,248,0.05)':'rgba(99,102,241,0.06)' }}
                data-testid="dashboard-view-all-docs-btn">
                <Link href="/documents">عرض الكل</Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderBottom:`1px solid ${txt.rowBorder}`, background: txt.hdrBgBlue }}>
                    {['رقم المستند','اسم المستند','النوع','المشروع','التاريخ'].map(h => (
                      <TableHead key={h} className="text-right whitespace-nowrap py-2.5 px-3 md:px-4 text-xs font-semibold"
                        style={{ color: txt.hdrBlue }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDocs.map((d, i) => {
                    const proj = projects.find(p => p.id === d.projectId);
                    return (
                      <TableRow key={d.id}
                        style={{ borderBottom:`1px solid ${txt.rowBorder}`, background: i%2===0 ? 'transparent' : txt.rowAlt }}>
                        <TableCell className="font-mono text-xs font-bold py-2.5 px-3 md:px-4 whitespace-nowrap"
                          style={{ color: txt.numBlue }}>{d.number}</TableCell>
                        <TableCell className="font-semibold text-xs max-w-[160px] truncate py-2.5 px-3 md:px-4"
                          style={{ color: txt.body }}>{d.name}</TableCell>
                        <TableCell className="py-2.5 px-3 md:px-4">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: isDark ? 'rgba(129,140,248,0.12)':'rgba(99,102,241,0.09)',
                              color: isDark ? '#818cf8':'#4f46e5', border:`1px solid ${isDark ? 'rgba(129,140,248,0.22)':'rgba(99,102,241,0.22)'}` }}>
                            {docTypeLabels[d.type] || d.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[130px] truncate py-2.5 px-3 md:px-4" style={{ color: txt.secondary }}>
                          {proj?.name}
                        </TableCell>
                        <TableCell className="text-xs py-2.5 px-3 md:px-4 whitespace-nowrap" style={{ color: txt.muted }}>
                          {new Date(d.createdAt).toLocaleDateString('ar-SA')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </GlassTable>
        </div>

        {/* Document KPI */}
        <div>
          <KpiCard
            label="إجمالي المستندات"
            value={documents.length}
            sub="+12 هذا الشهر"
            icon={FileText}
            variant="purple"
            isDark={isDark}
            testId="kpi-docs"
          />
        </div>

      </div>
    </div>
  );
}
