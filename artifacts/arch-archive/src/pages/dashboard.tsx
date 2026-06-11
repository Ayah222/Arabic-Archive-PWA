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
      background: 'rgba(255,255,255,0.90)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${accentColor}28`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.07), 0 1px 0 ${accentColor}18`,
    }}
  >
    {/* Top accent edge — laser in dark, solid stripe in light */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: isDark ? 1 : 2,
      background: `linear-gradient(to right, transparent 5%, ${accentColor}${isDark ? '90' : '70'} 35%, ${accentColor}${isDark ? 'CC' : 'AA'} 50%, ${accentColor}${isDark ? '90' : '70'} 65%, transparent 95%)`,
      boxShadow: isDark ? `0 0 8px ${accentColor}60` : 'none',
    }}/>
    {/* Corner accent glow — dark only */}
    {isDark && <div style={{
      position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%',
      background: accentColor, opacity: 0.06, filter: 'blur(30px)', pointerEvents: 'none',
    }}/>}
    <div className="relative z-10">{children}</div>
  </div>
  );
};

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

  const kpis = [
    {
      label: 'إجمالي المشاريع', value: stats.total, badge: '+5 هذا الشهر',
      icon: FolderKanban, testId: 'kpi-total',
      onClick: () => setLocation('/projects'),
      accent: '#00d483',
      iconGrad: 'linear-gradient(135deg, rgba(0,212,131,0.22) 0%, rgba(0,154,95,0.14) 100%)',
    },
    {
      label: 'المشاريع المكتملة', value: stats.completed, badge: '+2 هذا الشهر',
      icon: CheckCircle2, testId: 'kpi-completed',
      onClick: () => setLocation('/projects?status=completed'),
      accent: '#38bdf8',
      iconGrad: 'linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(14,116,189,0.14) 100%)',
    },
    {
      label: 'المشاريع النشطة', value: stats.active, badge: '+3 هذا الشهر',
      icon: Clock, testId: 'kpi-active',
      onClick: () => setLocation('/projects?status=active'),
      accent: '#a3e635',
      iconGrad: 'linear-gradient(135deg, rgba(163,230,53,0.22) 0%, rgba(101,163,13,0.14) 100%)',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <GlassCard key={kpi.testId} accentColor={kpi.accent} onClick={kpi.onClick} data-testid={kpi.testId}>
            <div className="p-6 flex items-center gap-4">
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: kpi.iconGrad,
                  border: `1px solid ${kpi.accent}30`,
                  boxShadow: `0 0 20px ${kpi.accent}28`,
                  color: kpi.accent,
                }}>
                <kpi.icon className="w-7 h-7"/>
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1" style={{ color: 'rgba(180,230,205,0.65)' }}>
                  {kpi.label}
                </p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black" data-testid={`${kpi.testId}-count`}
                    style={{ color: kpi.accent, textShadow: `0 0 20px ${kpi.accent}60` }}>
                    {kpi.value}
                  </h3>
                </div>
                <span className="text-xs font-semibold mt-0.5 block" style={{ color: `${kpi.accent}90` }}>
                  {kpi.badge}
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 shrink-0 opacity-30" style={{ color: kpi.accent }}/>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Latest Projects ── */}
      <GlassCard accentColor="#00d483">
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(0,212,131,0.55)' }}>✦</span>
            <h2 className="text-base font-bold" style={{ color: 'rgba(210,245,230,0.92)' }}>أحدث المشاريع</h2>
          </div>
          <Button variant="ghost" size="sm" asChild
            className="text-xs rounded-lg h-7 px-3"
            style={{ color: 'rgba(0,212,131,0.80)', border: '1px solid rgba(0,212,131,0.15)' }}
            data-testid="dashboard-view-all-projects">
            <Link href="/projects">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(0,212,131,0.12)', background: 'rgba(0,212,131,0.04)' }}>
                {['رقم المشروع','اسم المشروع','العميل','المدينة','النوع','تاريخ الإنشاء','آخر تحديث','الحالة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'rgba(0,212,131,0.75)' }}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((p, i) => (
                <TableRow key={p.id}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid rgba(0,212,131,0.06)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,212,131,0.02)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,131,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,212,131,0.02)')}
                  onClick={() => setLocation(`/projects/${p.id}`)}
                  data-testid={`dashboard-project-row-${p.id}`}
                >
                  <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color: '#00d483' }}>{p.number}</TableCell>
                  <TableCell className="font-semibold max-w-[200px] truncate py-3 px-4" style={{ color: 'rgba(220,245,235,0.90)' }}>{p.name}</TableCell>
                  <TableCell className="py-3 px-4" style={{ color: 'rgba(180,230,205,0.72)' }}>{p.client}</TableCell>
                  <TableCell className="py-3 px-4" style={{ color: 'rgba(180,230,205,0.72)' }}>{p.city}</TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(0,212,131,0.10)', color: 'rgba(0,212,131,0.85)', border: '1px solid rgba(0,212,131,0.15)' }}>
                      {PROJECT_TYPES[p.projectType]}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(180,230,205,0.65)' }}>{new Date(p.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(180,230,205,0.65)' }}>{new Date(p.updatedAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge className={`text-xs font-semibold border-0 ${p.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-sky-500/15 text-sky-400'}`}>
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
      <GlassCard accentColor="#38bdf8">
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(56,189,248,0.55)' }}>✦</span>
            <h2 className="text-base font-bold" style={{ color: 'rgba(210,245,230,0.92)' }}>أحدث المستندات</h2>
          </div>
          <Button variant="ghost" size="sm" asChild
            className="text-xs rounded-lg h-7 px-3"
            style={{ color: 'rgba(56,189,248,0.80)', border: '1px solid rgba(56,189,248,0.15)' }}
            data-testid="dashboard-view-all-docs-btn">
            <Link href="/documents">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(56,189,248,0.12)', background: 'rgba(56,189,248,0.04)' }}>
                {['رقم المستند','اسم المستند','النوع','المشروع','تاريخ الإضافة'].map(h => (
                  <TableHead key={h} className="text-right whitespace-nowrap py-3 px-4 text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'rgba(56,189,248,0.75)' }}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((d, i) => {
                const proj = projects.find(p => p.id === d.projectId);
                return (
                  <TableRow key={d.id}
                    style={{
                      borderBottom: '1px solid rgba(56,189,248,0.06)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(56,189,248,0.02)',
                    }}>
                    <TableCell className="font-mono text-sm font-bold py-3 px-4" style={{ color: '#38bdf8' }}>{d.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate py-3 px-4 font-semibold" style={{ color: 'rgba(220,245,235,0.90)' }}>{d.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: 'rgba(56,189,248,0.10)', color: 'rgba(56,189,248,0.85)', border: '1px solid rgba(56,189,248,0.15)' }}>
                        {docTypeLabels[d.type] || d.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate py-3 px-4" style={{ color: 'rgba(180,230,205,0.72)' }}>{proj?.name}</TableCell>
                    <TableCell className="py-3 px-4 whitespace-nowrap" style={{ color: 'rgba(180,230,205,0.65)' }}>{new Date(d.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* 4th stat card — documents */}
      <GlassCard accentColor="#a78bfa">
        <div className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background:'linear-gradient(135deg,rgba(167,139,250,0.22) 0%,rgba(109,40,217,0.14) 100%)', border:'1px solid rgba(167,139,250,0.25)', boxShadow:'0 0 20px rgba(167,139,250,0.22)', color:'#a78bfa' }}>
            <FileText className="w-7 h-7"/>
          </div>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color:'rgba(180,230,205,0.65)' }}>إجمالي المستندات</p>
            <h3 className="text-4xl font-black" style={{ color:'#a78bfa', textShadow:'0 0 20px rgba(167,139,250,0.50)' }}>
              {documents.length}
            </h3>
            <span className="text-xs font-semibold mt-0.5 block" style={{ color:'rgba(167,139,250,0.70)' }}>+12 هذا الشهر</span>
          </div>
          <ArrowUpRight className="w-4 h-4 mr-auto opacity-30" style={{ color:'#a78bfa' }}/>
        </div>
      </GlassCard>

    </div>
  );
}
