import { Project, Document, DocumentType } from '../types';

export const projectNames = [
  "مشروع برج الأعمال المركزي",
  "تطوير كورنيش الملك فهد",
  "مشروع مستشفى الأمل التخصصي",
  "إعادة تطوير حي الرياض التاريخي",
  "مشروع مجمع السكن الحكومي",
  "تصميم المطار الإقليمي الجديد",
  "مشروع الجامعة التقنية",
  "توسعة ميناء الملك عبدالعزيز",
  "تخطيط المدينة الذكية المتكاملة",
  "مشروع محطة معالجة المياه",
  "مشروع الحديقة الوطنية الكبرى",
  "تصميم متحف الفنون المعاصرة",
  "مشروع البنية التحتية للطاقة الشمسية",
  "تطوير المنطقة التجارية المركزية",
  "مشروع الملعب الوطني متعدد الأغراض",
  "مشروع جسر العبور المعلق",
  "تصميم مركز المؤتمرات الدولي",
  "تطوير شبكة النقل العام",
  "مشروع مجمع المحاكم الشرعية",
  "إعادة تأهيل القلعة الأثرية",
  "مشروع مدينة الملك عبدالله الطبية",
  "تصميم المسرح الوطني للثقافة",
  "مشروع الأبراج السكنية المزدوجة",
  "تطوير الساحة الإدارية المركزية",
  "مشروع محطة قطار الحرمين",
  "تصميم واجهة بحرية سياحية",
  "مشروع المجمع التجاري الفاخر",
  "توسعة الطريق الدائري الجنوبي",
  "مشروع المركز المالي العالمي",
  "تخطيط المنطقة الصناعية الجديدة"
];

const clients = [
  "وزارة الإسكان",
  "أمانة العاصمة",
  "الهيئة العامة للمواصلات",
  "وزارة الصحة",
  "الهيئة الملكية",
  "شركة التطوير العمراني",
  "الشركة الوطنية للاستثمار"
];

const typePrefixes: Record<DocumentType, string> = {
  contract: 'CON',
  quotation: 'QUO',
  employee_data: 'EMP',
  report: 'REP',
  image: 'PIC',
  meeting: 'MTG',
  letter: 'LTR',
  contractor: 'CTR',
  drawing: 'DRW'
};

const docCounts: Record<DocumentType, number> = {
  contract: 0,
  quotation: 0,
  employee_data: 0,
  report: 0,
  image: 0,
  meeting: 0,
  letter: 0,
  contractor: 0,
  drawing: 0
};

export const mockProjects: Project[] = projectNames.map((name, index) => {
  const isCompleted = index % 3 === 0;
  return {
    id: `proj_${index + 1}`,
    number: `PRJ-${String(index + 1).padStart(3, '0')}`,
    name,
    client: clients[index % clients.length],
    status: isCompleted ? 'completed' : 'active',
    createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
    coverImage: `https://picsum.photos/seed/arch_${index + 1}/800/400`
  };
});

export const mockDocuments: Document[] = [];

mockProjects.forEach((project) => {
  const numDocs = Math.floor(Math.random() * 10) + 5;
  const types: DocumentType[] = Object.keys(typePrefixes) as DocumentType[];
  
  for (let i = 0; i < numDocs; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    docCounts[type]++;
    
    mockDocuments.push({
      id: `doc_${Math.random().toString(36).substring(2, 9)}`,
      number: `${typePrefixes[type]}-${docCounts[type]}`,
      name: `مستند ${typePrefixes[type]} لمشروع ${project.number}`,
      type,
      projectId: project.id,
      createdAt: new Date(Date.now() - Math.random() * 5000000000).toISOString(),
    });
  }
});
