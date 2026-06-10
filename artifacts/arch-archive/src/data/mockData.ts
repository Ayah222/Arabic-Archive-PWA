import { Project, Document, DocumentType, ProjectType, CITIES } from '../types';

const projectNames = [
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
  "تخطيط المنطقة الصناعية الجديدة",
];

const clients = [
  "وزارة الإسكان",
  "أمانة العاصمة",
  "الهيئة العامة للمواصلات",
  "وزارة الصحة",
  "الهيئة الملكية",
  "شركة التطوير العمراني",
  "الشركة الوطنية للاستثمار",
  "وزارة التعليم",
  "أمانة منطقة مكة المكرمة",
  "هيئة تطوير المنطقة الشرقية",
];

const projectTypes: ProjectType[] = [
  'commercial', 'residential', 'healthcare', 'urban_planning', 'residential',
  'infrastructure', 'educational', 'infrastructure', 'urban_planning', 'infrastructure',
  'landscape', 'mixed_use', 'infrastructure', 'commercial', 'mixed_use',
  'infrastructure', 'administrative', 'infrastructure', 'administrative', 'mixed_use',
  'healthcare', 'mixed_use', 'residential', 'administrative', 'infrastructure',
  'hospitality', 'commercial', 'infrastructure', 'commercial', 'industrial',
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
  drawing: 'DRW',
};

const docCounts: Record<DocumentType, number> = {
  contract: 0, quotation: 0, employee_data: 0, report: 0, image: 0,
  meeting: 0, letter: 0, contractor: 0, drawing: 0,
};

const docNamesByType: Record<DocumentType, string[]> = {
  contract: ['عقد تنفيذ الأعمال', 'عقد الاستشارة الهندسية', 'عقد التوريد', 'عقد الصيانة'],
  quotation: ['عرض سعر مقاولة', 'عرض سعر توريد مواد', 'عرض سعر تصميم', 'عرض سعر إشراف'],
  employee_data: ['بيانات المهندس المشرف', 'بيانات فريق التصميم', 'بيانات المراقب الميداني'],
  report: ['تقرير التقدم الشهري', 'تقرير الجودة', 'تقرير الموقع', 'تقرير الانتهاء'],
  image: ['صور الموقع الابتدائية', 'صور مرحلة الإنشاء', 'صور التسليم النهائي'],
  meeting: ['محضر الاجتماع التأسيسي', 'اجتماع متابعة التنفيذ', 'اجتماع التسليم'],
  letter: ['خطاب إشعار البدء', 'خطاب تمديد المدة', 'خطاب المطالبة المالية'],
  contractor: ['بيانات المقاول الرئيسي', 'بيانات مقاول الكهرباء', 'بيانات مقاول السباكة'],
  drawing: ['مخططات الموقع العام', 'مخططات المعمارية', 'مخططات الإنشائية', 'مخططات الكهربائية'],
};

export const mockProjects: Project[] = projectNames.map((name, index) => {
  const isCompleted = index % 3 === 0;
  const baseDate = new Date(2023, 0, 1).getTime();
  const createdAt = new Date(baseDate + index * 15 * 24 * 60 * 60 * 1000).toISOString();
  const updatedAt = new Date(baseDate + index * 15 * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `proj_${index + 1}`,
    number: `PRJ-${String(index + 1).padStart(3, '0')}`,
    name,
    client: clients[index % clients.length],
    city: CITIES[index % CITIES.length],
    projectType: projectTypes[index],
    status: isCompleted ? 'completed' : 'active',
    createdAt,
    updatedAt,
    coverImage: `https://picsum.photos/seed/arch_${index + 1}/800/400`,
  };
});

export const mockDocuments: Document[] = [];

mockProjects.forEach((project) => {
  const numDocs = Math.floor(Math.random() * 8) + 4;
  const types: DocumentType[] = Object.keys(typePrefixes) as DocumentType[];

  for (let i = 0; i < numDocs; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    docCounts[type]++;
    const nameOptions = docNamesByType[type];
    const docName = nameOptions[Math.floor(Math.random() * nameOptions.length)];

    mockDocuments.push({
      id: `doc_${project.id}_${i}`,
      number: `${typePrefixes[type]}-${docCounts[type]}`,
      name: `${docName} - ${project.name.split(' ').slice(0, 3).join(' ')}`,
      type,
      projectId: project.id,
      createdAt: new Date(
        new Date(project.createdAt).getTime() + Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }
});
