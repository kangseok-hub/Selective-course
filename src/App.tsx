import { useState, useMemo, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { 
  BookOpen, 
  GraduationCap, 
  Search, 
  ChevronRight, 
  Info, 
  CheckCircle2,
  LayoutGrid,
  ListFilter,
  Calendar,
  Layers,
  FileText,
  CheckSquare,
  Printer,
  Download,
  Plus,
  X,
  Save,
  Trash2,
  Settings
} from 'lucide-react';
import { FIELD_DATA, SUBJECT_AREAS, SUBJECT_TYPES, SUNGSHIN_GROUPS, MANDATORY_SUBJECTS, Major, Field, SelectionGroup, SungshinSubject } from './data/curriculumData';
import { UNIVERSITY_TIPS, UniversityTip } from './data/universityData';

export default function App() {
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'subject' | 'group' | 'plan'>('subject');
  const [planGrade, setPlanGrade] = useState<2 | 3>(2);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customGroups, setCustomGroups] = useState<SelectionGroup[]>([]);
  const [customMandatory, setCustomMandatory] = useState<Record<number, SungshinSubject[]>>({});
  const [tempMandatory, setTempMandatory] = useState({
    '2-1': '',
    '2-2': '',
    '3-1': '',
    '3-2': ''
  });
  const [tempGroups, setTempGroups] = useState<any[]>([
    { id: Date.now(), grade: 2, semester: '1학기', credits: 4, selectCount: 1, subjects: '' }
  ]);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [univSearchTerm, setUnivSearchTerm] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const normalizeSubjectName = (name: string) => {
    if (!name) return '';
    return name
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/Ⅰ/g, '1')
      .replace(/Ⅱ/g, '2')
      .replace(/Ⅲ/g, '3')
      .replace(/Ⅳ/g, '4')
      .replace(/Ⅴ/g, '5')
      .replace(/Ⅵ/g, '6')
      .replace(/Ⅶ/g, '7')
      .replace(/Ⅷ/g, '8')
      .replace(/Ⅸ/g, '9')
      .replace(/Ⅹ/g, '10')
      .toLowerCase();
  };

  const handleAddGroup = () => {
    setTempGroups([...tempGroups, { id: Date.now(), grade: 2, semester: '1학기', credits: 4, selectCount: 1, subjects: '' }]);
  };

  const handleRemoveGroup = (id: number) => {
    setTempGroups(tempGroups.filter(g => g.id !== id));
  };

  const handleUpdateGroup = (id: number, field: string, value: any) => {
    setTempGroups(tempGroups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const handleDone = () => {
    // Process Mandatory Subjects
    const newMandatory: Record<number, SungshinSubject[]> = { 2: [], 3: [] };
    
    const processSemester = (grade: number, semester: number, input: string) => {
      const subjects = input.split(',').map(s => s.trim()).filter(s => s !== '');
      subjects.forEach(name => {
        const existing = newMandatory[grade].find(s => s.name === name);
        if (existing) {
          if (!existing.semesters.includes(semester)) {
            existing.semesters.push(semester);
            existing.semesters.sort();
          }
        } else {
          newMandatory[grade].push({ name, semesters: [semester] });
        }
      });
    };

    processSemester(2, 1, tempMandatory['2-1']);
    processSemester(2, 2, tempMandatory['2-2']);
    processSemester(3, 1, tempMandatory['3-1']);
    processSemester(3, 2, tempMandatory['3-2']);

    setCustomMandatory(newMandatory);

    // Process Selection Groups
    const newGroups: SelectionGroup[] = tempGroups.map((g, idx) => ({
      id: `선택군${idx + 1}`,
      grade: g.grade,
      semester: g.semester,
      selectCount: g.selectCount,
      credits: g.credits,
      description: `${g.grade}학년 ${g.semester} 선택과목군 ${idx + 1} (택${g.selectCount})`,
      subjects: g.subjects.split(',').map((s: string) => ({
        name: s.trim(),
        semesters: g.semester === '1학기' ? [1] : [2]
      })).filter((s: any) => s.name !== '')
    }));
    setCustomGroups(newGroups);
    setIsCustomMode(true);
    setShowCustomForm(false);
  };

  // All majors flattened for global search
  const allMajors = useMemo(() => {
    return FIELD_DATA.flatMap(field => 
      field.majors.map(major => ({ ...major, fieldName: field.name }))
    );
  }, []);

  // Filtered majors based on search term
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return allMajors.filter(major => 
      major.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, allMajors]);

  // Group subjects by area for the selected major
  const normalizeMajorName = (name: string) => {
    if (!name) return '';
    return name
      .replace(/\s+/g, '')
      .replace(/(학과|학부|전공|계열)$/, '')
      .toLowerCase();
  };

  const universityTips = useMemo(() => {
    if (!selectedMajor) return [];
    
    const normalizedMajorName = normalizeMajorName(selectedMajor.name);
    
    return UNIVERSITY_TIPS.filter(tip => {
      const normalizedTipMajor = normalizeMajorName(tip.major);
      const isMatch = normalizedTipMajor.includes(normalizedMajorName) || normalizedMajorName.includes(normalizedTipMajor);
      
      if (!isMatch) return false;
      
      if (univSearchTerm) {
        const search = univSearchTerm.toLowerCase();
        return tip.university.toLowerCase().includes(search) || 
               tip.location.toLowerCase().includes(search) ||
               tip.major.toLowerCase().includes(search);
      }
      
      return true;
    });
  }, [selectedMajor, univSearchTerm]);

  const subjectsByArea = useMemo(() => {
    if (!selectedMajor) return null;

    const grouped: Record<string, string[]> = {};
    
    selectedMajor.recommendedSubjects.forEach(subjectName => {
      // Find which area this subject belongs to
      let areaFound = '기타';
      for (const [area, subjects] of Object.entries(SUBJECT_AREAS)) {
        if (subjects.includes(subjectName)) {
          areaFound = area;
          break;
        }
      }

      if (!grouped[areaFound]) grouped[areaFound] = [];
      grouped[areaFound].push(subjectName);
    });

    return grouped;
  }, [selectedMajor]);

  const handleFieldSelect = (field: Field) => {
    setSelectedField(field);
    setSelectedMajor(null);
    setSearchTerm(''); // Clear search when picking a field
  };

  const handleMajorSelect = (major: Major) => {
    setSelectedMajor(major);
    // If we were searching, we might not have the field set
    if (!selectedField) {
      const field = FIELD_DATA.find(f => f.majors.some(m => m.name === major.name));
      if (field) setSelectedField(field);
    }
  };

  const resetSelection = () => {
    setSelectedField(null);
    setSelectedMajor(null);
    setSearchTerm('');
  };

  const handlePrint = () => {
    setErrorMsg(null);
    try {
      window.print();
    } catch (error) {
      console.error('Print failed:', error);
      setErrorMsg('인쇄 기능을 실행할 수 없습니다. 브라우저 설정을 확인해 주세요.');
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current || !selectedMajor || isDownloading) return;

    setIsDownloading(true);
    setErrorMsg(null);
    try {
      const element = printRef.current;
      
      // Use html-to-image for better compatibility with modern CSS (oklch)
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15; // Set margin to 15mm as requested
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));
      
      // Calculate dimensions to fit exactly on one page within margins
      const maxAvailableWidth = pdfWidth - (margin * 2);
      const maxAvailableHeight = pdfHeight - (margin * 2);
      
      const printScale = 1.0; // Scale to 100% of available space within margins
      let finalWidth = maxAvailableWidth * printScale;
      let finalHeight = (img.height * finalWidth) / img.width;
      
      if (finalHeight > maxAvailableHeight * printScale) {
        finalHeight = maxAvailableHeight * printScale;
        finalWidth = (img.width * finalHeight) / img.height;
      }

      const xPos = (pdfWidth - finalWidth) / 2;
      const yPos = margin; // Start from top margin to maximize space
      
      pdf.addImage(dataUrl, 'JPEG', xPos, yPos, finalWidth, finalHeight);
      pdf.save(`2022개정_선택과목가이드_${selectedMajor.name}_${planGrade}학년.pdf`);
    } catch (error: any) {
      console.error('PDF generation failed:', error);
      setErrorMsg(`PDF 생성 실패: 브라우저 호환성 문제. 인쇄(PDF로 저장)를 이용해 주세요.`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper to determine grading type based on image example
  const getGradingType = (name: string, type: string) => {
    const normalizedName = normalizeSubjectName(name);
    const coreSubjects = ['문학', '독서와 작문', '대수', '미적분Ⅰ', '영어Ⅰ', '영어Ⅱ'].map(normalizeSubjectName);
    if (coreSubjects.includes(normalizedName)) return '수능 출제/5등급';
    
    const achievement3 = [
      '운동과 건강', '스포츠 생활1', '스포츠 생활2', '음악 연주와 작창', '음악 연주와 창작', 
      '미술 창작', '음악 감상과 비평', '미술과 매체', '음악과 미디어', '미술 감상과 비평', 
      '스포츠 문화', '스포츠 문학', '스포츠 과학'
    ].map(normalizeSubjectName);
    if (achievement3.includes(normalizedName)) return '성취도 3단계';
    
    const achievement5 = ['기후변화와 환경생태'].map(normalizeSubjectName);
    if (achievement5.includes(normalizedName)) return '성취도 5단계';
    
    return '5등급';
  };

  // Structured data for the plan view (grouped by selection group AND academic area)
  const planData = useMemo(() => {
    if (!selectedMajor) return [];
    
    const groupsToUse = isCustomMode ? customGroups : SUNGSHIN_GROUPS;
    
    return groupsToUse.filter(g => g.grade === planGrade).map(group => {
      const subjectsWithMetadata = group.subjects.map(subject => {
        const normalizedName = normalizeSubjectName(subject.name);
        const area = Object.keys(SUBJECT_AREAS).find(a => 
          SUBJECT_AREAS[a].some(s => normalizeSubjectName(s) === normalizedName)
        ) || '기타';
        const typeKey = Object.keys(SUBJECT_TYPES).find(k => normalizeSubjectName(k) === normalizedName);
        const type = typeKey ? SUBJECT_TYPES[typeKey] : '일반';
        const isRecommended = selectedMajor.recommendedSubjects.some(s => normalizeSubjectName(s) === normalizedName);
        const gradingType = getGradingType(subject.name, type);
        return { ...subject, area, type, isRecommended, gradingType };
      });

      // Group by area
      const groupedByArea: Record<string, typeof subjectsWithMetadata> = {};
      subjectsWithMetadata.forEach(s => {
        if (!groupedByArea[s.area]) groupedByArea[s.area] = [];
        groupedByArea[s.area].push(s);
      });

      return {
        ...group,
        formattedLabel: `${group.id} [택${group.selectCount}] (${group.credits || 4}학점)`,
        groupedSubjects: Object.entries(groupedByArea).map(([area, subjects]) => ({
          area,
          subjects
        }))
      };
    });
  }, [selectedMajor, planGrade]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={resetSelection}>
            <div className="bg-blue-600 p-2 rounded-lg shadow-md shadow-blue-100">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight hidden sm:block">
              2022 개정교육과정 <span className="text-blue-600">선택과목 가이드</span>
            </h1>
            <h1 className="font-bold text-xl tracking-tight sm:hidden">
              개정과목 가이드
            </h1>
          </div>
          
          <div className="flex-1 max-w-md flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="학과명을 입력하세요 (예: 의예과, 경영...)"
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-2 border-transparent rounded-full text-sm focus:bg-white focus:border-blue-500 focus:ring-0 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.trim()) {
                    setSelectedMajor(null);
                  }
                }}
              />
            </div>
            
            <button 
              onClick={() => setShowCustomForm(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">교육과정 입력</span>
            </button>
            
            {isCustomMode && (
              <button 
                onClick={() => {
                  setIsCustomMode(false);
                  setCustomGroups([]);
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">초기화</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
        {!selectedMajor ? (
          <div className="space-y-8">
            {/* Hero Section - Only show when not searching or field selected */}
            {!searchTerm && !selectedField && (
              <section className="text-center space-y-4 py-12">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-block p-3 bg-blue-50 rounded-2xl mb-2"
                >
                  <GraduationCap className="w-10 h-10 text-blue-600" />
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight"
                >
                  <span className="text-blue-600 relative">
                    맞춤형 과목 설계
                    <svg className="absolute -bottom-2 left-0 w-full h-2 text-blue-200" viewBox="0 0 100 10" preserveAspectRatio="none">
                      <path d="M0 5 Q 25 0 50 5 T 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                    </svg>
                  </span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-slate-500 max-w-2xl mx-auto text-lg"
                >
                  이 자료는 학과바이들(캠퍼스멘토) 및 각 시도교육청, 대학 권장과목의 내용을 바탕으로 제작되었습니다.
                </motion.p>
              </section>
            )}

            {/* Search Results or Field Selection */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Sidebar - Fields */}
              <div className="md:col-span-1 space-y-3">
                <div className="flex items-center gap-2 px-2 py-1 text-slate-400 font-bold text-xs uppercase tracking-widest">
                  <LayoutGrid className="w-3 h-3" />
                  <span>분야 카테고리</span>
                </div>
                <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                  {FIELD_DATA.map((field) => (
                    <button
                      key={field.name}
                      onClick={() => handleFieldSelect(field)}
                      className={`whitespace-nowrap text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group shrink-0 md:shrink ${
                        selectedField?.name === field.name && !searchTerm
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span className="font-semibold text-sm">{field.name}</span>
                      <ChevronRight className={`hidden md:block w-4 h-4 transition-transform ${selectedField?.name === field.name && !searchTerm ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <div className="md:col-span-3">
                <AnimatePresence mode="wait">
                  {searchTerm.trim() ? (
                    /* Global Search Results View */
                    <motion.div
                      key="search-results"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[400px]"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Search className="text-blue-600 w-5 h-5" />
                          <h3 className="text-xl font-bold">검색 결과</h3>
                        </div>
                        <span className="text-sm text-slate-400 font-medium">{searchResults.length}개의 학과 발견</span>
                      </div>
                      
                      {searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {searchResults.map((major) => (
                            <button
                              key={`${major.fieldName}-${major.name}`}
                              onClick={() => handleMajorSelect(major)}
                              className="text-left p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-all group"
                            >
                              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">{major.fieldName}</div>
                              <div className="font-bold text-slate-700 group-hover:text-blue-700">{major.name}</div>
                              <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <span>상세 과목 보기</span>
                                <ChevronRight className="w-3 h-3" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                          <div className="p-4 bg-slate-50 rounded-full">
                            <Search className="w-10 h-10" />
                          </div>
                          <p className="font-medium">검색 결과가 없습니다.</p>
                          <button 
                            onClick={() => setSearchTerm('')}
                            className="text-blue-600 text-sm font-bold hover:underline"
                          >
                            검색어 초기화
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : selectedField ? (
                    /* Field-specific Majors View */
                    <motion.div
                      key={selectedField.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[400px]"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="text-blue-600 w-6 h-6" />
                          <h3 className="text-xl font-bold">{selectedField.name}</h3>
                        </div>
                        <span className="text-sm text-slate-400 font-medium">{selectedField.majors.length}개의 학과</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedField.majors.map((major) => (
                          <button
                            key={major.name}
                            onClick={() => handleMajorSelect(major)}
                            className="text-left p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-all group"
                          >
                            <div className="font-bold text-slate-700 group-hover:text-blue-700">{major.name}</div>
                            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                              <span>추천 과목 보기</span>
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    /* Empty State - Prompt to Select */
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 text-center space-y-4 min-h-[400px]">
                      <div className="bg-slate-50 p-6 rounded-full">
                        <ListFilter className="w-12 h-12 text-slate-300" />
                      </div>
                      <div>
                        <p className="font-bold text-xl text-slate-600">탐색을 시작해보세요</p>
                        <p className="text-sm max-w-xs mx-auto mt-2">왼쪽 카테고리에서 분야를 선택하거나 상단에서 학과를 직접 검색할 수 있습니다.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          /* Subject Display Section */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Breadcrumbs & Back Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 print:hidden">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <button onClick={resetSelection} className="hover:text-blue-600 transition-colors">홈</button>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => setSelectedMajor(null)} className="hover:text-blue-600 transition-colors">{selectedField?.name}</button>
                <ChevronRight className="w-3 h-3" />
                <span className="font-semibold text-blue-600">{selectedMajor.name}</span>
              </div>
              
              <button 
                onClick={() => setSelectedMajor(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                다른 학과 찾아 보기
              </button>
            </div>

            {/* Major Header */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden print:hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <GraduationCap className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>권장 선택과목 안내</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900">{selectedMajor.name}</h2>
                  </div>
                  
                  {/* View Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                    <button 
                      onClick={() => setViewMode('subject')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'subject' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Layers className="w-4 h-4" />
                      교과군별
                    </button>
                    <button 
                      onClick={() => setViewMode('group')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'group' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Calendar className="w-4 h-4" />
                      선택그룹
                    </button>
                    <button 
                      onClick={() => setViewMode('plan')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <FileText className="w-4 h-4" />
                      수강신청 계획서
                    </button>
                  </div>
                </div>
                <div className="text-slate-500 max-w-2xl">
                  <p className="font-medium text-slate-700">
                    {selectedMajor.name} 전공을 희망하는 학생을 위한 맞춤형 가이드입니다.
                  </p>
                  <p className="mt-1 text-sm">
                    대학에서 권장하는 핵심 과목들을 교과 영역별로 확인해보세요.
                  </p>
                </div>
              </div>
            </div>

            {/* University Specific Tips Section */}
            {universityTips.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="text-white w-5 h-5" />
                    <h3 className="text-white font-bold">2028학년도 대학별 권장과목 가이드</h3>
                  </div>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                    <input 
                      type="text"
                      placeholder="대학명 또는 지역 검색..."
                      value={univSearchTerm}
                      onChange={(e) => setUnivSearchTerm(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-4 py-2 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 whitespace-nowrap">권역/지역</th>
                        <th className="px-6 py-3 whitespace-nowrap">대학교</th>
                        <th className="px-6 py-3 whitespace-nowrap">모집단위</th>
                        <th className="px-6 py-3">핵심과목 (필수 권장)</th>
                        <th className="px-6 py-3">권장과목 (가급적 권장)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {universityTips.map((tip, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 uppercase font-bold">{tip.region}</span>
                              <span className="text-slate-600 font-medium">{tip.location}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">{tip.university}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{tip.major}</td>
                          <td className="px-6 py-4 text-slate-600">
                            {tip.core !== '-' ? (
                              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium inline-block leading-relaxed">
                                {tip.core}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            <div className="space-y-1.5">
                              {tip.recommended !== '-' && tip.recommended !== '' ? (
                                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-medium inline-block leading-relaxed">
                                  {tip.recommended}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                              {tip.note && tip.note !== '-' && (
                                <p className="text-[10px] text-slate-400 italic leading-snug bg-slate-50/50 p-2 rounded-md border border-slate-100">
                                  {tip.note}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {universityTips.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>검색 결과가 없습니다.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Subjects Grid by Area or Group or Plan */}
            <div className="grid grid-cols-1 gap-6">
              {viewMode === 'subject' ? (
                Object.entries(subjectsByArea || {}).map(([area, subjects]) => {
                  const subjectList = subjects as string[];
                  return (
                    <motion.div 
                      key={area}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                    >
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="font-bold text-lg flex items-center gap-2">
                          <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                          {area} 교과군
                        </h4>
                        <span className="text-xs text-slate-400 font-medium">{subjectList.length}개 과목</span>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {subjectList.map((subject) => {
                            const type = SUBJECT_TYPES[subject] || '일반';
                            const typeColors = {
                              '일반': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                              '진로': 'bg-blue-50 text-blue-700 border-blue-100',
                              '융합': 'bg-purple-50 text-purple-700 border-purple-100'
                            };

                            return (
                              <div 
                                key={subject}
                                className="p-4 rounded-xl border border-slate-100 bg-white hover:shadow-md transition-shadow flex flex-col justify-between gap-3"
                              >
                                <div className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md inline-block self-start">
                                  {subject}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${typeColors[type]}`}>
                                    {type} 선택
                                  </span>
                                  <button className="text-slate-300 hover:text-blue-500 transition-colors">
                                    <Info className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : viewMode === 'group' ? (
                (isCustomMode ? customGroups : SUNGSHIN_GROUPS).map((group) => {
                  const recommendedInGroup = group.subjects.filter(s => selectedMajor.recommendedSubjects.includes(s.name));
                  
                  return (
                    <motion.div 
                      key={group.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${recommendedInGroup.length > 0 ? 'border-blue-200 ring-1 ring-blue-50' : 'border-slate-200 opacity-80'}`}
                    >
                      <div className={`px-6 py-4 border-b flex items-center justify-between ${recommendedInGroup.length > 0 ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-fit px-3 h-10 rounded-xl flex items-center justify-center font-bold whitespace-nowrap ${recommendedInGroup.length > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {group.id}
                          </div>
                          <div>
                            <h4 className={`font-bold ${recommendedInGroup.length > 0 ? 'text-blue-900' : 'text-slate-700'}`}>
                              {group.description}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{group.semester}</p>
                          </div>
                        </div>
                        {recommendedInGroup.length > 0 && (
                          <div className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                            추천 과목 있음
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.subjects.map((subject) => {
                            const isRecommended = selectedMajor.recommendedSubjects.includes(subject.name);
                            const type = SUBJECT_TYPES[subject.name] || '일반';
                            
                            return (
                              <div 
                                key={subject.name}
                                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                                  isRecommended 
                                    ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02] z-10' 
                                    : 'border-slate-100 bg-white opacity-60 grayscale-[0.5]'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className={`font-bold px-2 py-1 rounded-md inline-block ${isRecommended ? 'text-blue-700 bg-white' : 'text-slate-500 bg-slate-100'}`}>
                                    {subject.name}
                                  </div>
                                  {isRecommended && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                    isRecommended ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-100'
                                  }`}>
                                    {type} 선택
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-bold">
                                    {subject.semesters.join(', ')}학기
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                /* Course Registration Plan View (Table Format) */
                <div className="space-y-4">
                  {/* Action Buttons - Outside the print ref */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden relative z-50">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <FileText className="text-blue-600 w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">수강 신청 계획서</h3>
                        <p className="text-xs text-slate-400">{selectedMajor.name} 전공 권장</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {errorMsg && (
                        <div className="text-xs text-red-500 mr-4 font-medium animate-bounce max-w-[200px]">
                          {errorMsg}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button 
                            onClick={() => setPlanGrade(2)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${planGrade === 2 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            2학년
                          </button>
                          <button 
                            onClick={() => setPlanGrade(3)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${planGrade === 3 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            3학년
                          </button>
                        </div>
                        
                        <button 
                          onClick={handleDownloadPDF}
                          disabled={isDownloading}
                          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-all ${
                            isDownloading 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                          }`}
                        >
                          {isDownloading ? (
                            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          {isDownloading ? '생성 중...' : `${planGrade}학년 PDF 다운로드`}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={printRef}
                    id="printable-plan"
                    className="bg-white print-area print:shadow-none print:border-none print:rounded-none"
                    style={{ 
                      backgroundColor: '#ffffff', 
                      width: '100%', 
                      height: 'auto', 
                      overflow: 'visible', 
                      position: 'relative',
                      padding: '0',
                      margin: '0'
                    }}
                  >
                    <div style={{ 
                      borderBottom: '1px solid #cbd5e1', 
                      padding: '0.8rem 1rem', 
                      display: 'flex', 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      gap: '0.5rem', 
                      backgroundColor: '#1e40af' 
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText style={{ color: '#ffffff', width: '1rem', height: '1rem' }} />
                          <h3 style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1rem', margin: 0 }}>{planGrade}학년 수강 신청 계획서</h3>
                        </div>
                        <div style={{ color: '#dbeafe', fontSize: '0.65rem', fontWeight: 'bold' }}>숭신고등학교 | {selectedMajor.name} 전공 권장</div>
                      </div>
                      
                      <div style={{ width: '100%', overflow: 'visible', position: 'relative', padding: '1.2rem' }}>
                        <table style={{ width: '100%', fontSize: '0.65rem', textAlign: 'left', borderCollapse: 'collapse', border: '1px solid #cbd5e1', tableLayout: 'fixed' }}>
                          <thead style={{ backgroundColor: '#f8fafc', color: '#000000', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1', width: '4rem', textAlign: 'center' }}>선택 방법</th>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1', width: '6rem' }}>교과군</th>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1' }}>과목</th>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1', width: '4.5rem', textAlign: 'center' }}>과목 구분</th>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1', width: '3rem', textAlign: 'center' }}>1학기</th>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1', width: '3rem', textAlign: 'center' }}>2학기</th>
                              <th style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #cbd5e1', width: '6rem', textAlign: 'center' }}>성적처리 유형</th>
                              <th style={{ padding: '0.5rem 0.4rem', width: '5rem', textAlign: 'center' }}>메모</th>
                            </tr>
                          </thead>
                          <tbody style={{ borderTop: '1px solid #cbd5e1' }}>
                            {/* Mandatory Subjects */}
                            {((isCustomMode ? customMandatory[planGrade] : MANDATORY_SUBJECTS[planGrade]) || []).map((subject, idx) => {
                              const normalizedName = normalizeSubjectName(subject.name);
                              const area = Object.keys(SUBJECT_AREAS).find(a => 
                                SUBJECT_AREAS[a].some(s => normalizeSubjectName(s) === normalizedName)
                              ) || '공통';
                              const typeKey = Object.keys(SUBJECT_TYPES).find(k => normalizeSubjectName(k) === normalizedName);
                              const type = typeKey ? SUBJECT_TYPES[typeKey] : '일반';
                              const gradingType = getGradingType(subject.name, type);
                              return (
                                <tr key={`mandatory-${planGrade}-${subject.name}`} style={{ backgroundColor: '#eff6ff', borderBottom: '1px solid #cbd5e1' }}>
                                  {idx === 0 && (
                                    <td rowSpan={((isCustomMode ? customMandatory[planGrade] : MANDATORY_SUBJECTS[planGrade]) || []).length} style={{ padding: '0.4rem', borderRight: '1px solid #cbd5e1', fontWeight: '900', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.6rem' }}>필수</td>
                                  )}
                                  <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', color: '#000000' }}>{area}</td>
                                  <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', color: '#000000' }}>{subject.name}</td>
                                  <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontSize: '7px', color: '#000000' }}>{type} 선택</td>
                                  <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>
                                    {subject.semesters.includes(1) && (
                                      <div style={{ width: '0.9rem', height: '0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', margin: '0 auto' }}>
                                        <CheckSquare style={{ width: '0.7rem', height: '0.7rem', color: '#000000' }} />
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>
                                    {subject.semesters.includes(2) && (
                                      <div style={{ width: '0.9rem', height: '0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', margin: '0 auto' }}>
                                        <CheckSquare style={{ width: '0.7rem', height: '0.7rem', color: '#000000' }} />
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontSize: '8px', color: '#000000' }}>
                                    {gradingType}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.4rem' }}></td>
                                </tr>
                              );
                            })}

                            {/* Selection Groups */}
                            {planData.map((group) => (
                              <Fragment key={group.id}>
                                {group.groupedSubjects.map((areaGroup, aIdx) => (
                                  areaGroup.subjects.map((subject, sIdx) => {
                                    const isLastInGroup = aIdx === group.groupedSubjects.length - 1 && sIdx === areaGroup.subjects.length - 1;
                                    return (
                                      <tr key={`${group.id}-${subject.name}`} style={{ 
                                        backgroundColor: subject.isRecommended ? '#eff6ff' : '#ffffff',
                                        borderBottom: isLastInGroup ? '2px solid #475569' : '1px solid #cbd5e1',
                                        borderTop: (aIdx === 0 && sIdx === 0) ? '2px solid #475569' : 'none'
                                      }}>
                                        {aIdx === 0 && sIdx === 0 && (
                                          <td rowSpan={group.subjects.length} style={{ 
                                            padding: '0.4rem', 
                                            borderRight: '1px solid #cbd5e1', 
                                            fontWeight: 'bold', 
                                            color: '#000000', 
                                            textAlign: 'center', 
                                            backgroundColor: '#ffffff',
                                            verticalAlign: 'middle'
                                          }}>
                                            <div style={{ color: '#000000', fontSize: '0.6rem', fontWeight: 'bold', lineHeight: '1.2' }}>
                                              {group.id}<br/>
                                              [택{group.selectCount}]<br/>
                                              ({group.credits || 4}학점)
                                            </div>
                                          </td>
                                        )}
                                        {sIdx === 0 && (
                                          <td rowSpan={areaGroup.subjects.length} style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', color: '#000000', fontWeight: '500', backgroundColor: '#ffffff' }}>
                                            {areaGroup.area}
                                          </td>
                                        )}
                                        <td style={{ 
                                          padding: '0.4rem 0.4rem', 
                                          borderRight: '1px solid #cbd5e1', 
                                          fontWeight: subject.isRecommended ? 'bold' : '500',
                                          color: '#000000'
                                        }}>
                                          {subject.name}
                                        </td>
                                      <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>
                                        <span style={{ 
                                          fontSize: '7px', 
                                          padding: '0.1rem 0.4rem', 
                                          borderRadius: '9999px', 
                                          fontWeight: 'bold',
                                          backgroundColor: subject.type === '진로' ? '#dbeafe' : subject.type === '융합' ? '#f3e8ff' : '#d1fae5',
                                          color: '#000000',
                                          border: '1px solid #cbd5e1'
                                        }}>
                                          {subject.type} 선택
                                        </span>
                                      </td>
                                      <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>
                                        {subject.semesters.includes(1) && (
                                          <div style={{ width: '0.9rem', height: '0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: subject.isRecommended ? '#000000' : '#ffffff', margin: '0 auto' }}>
                                            {subject.isRecommended && <CheckSquare style={{ width: '0.7rem', height: '0.7rem', color: '#ffffff' }} />}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>
                                        {subject.semesters.includes(2) && (
                                          <div style={{ width: '0.9rem', height: '0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: subject.isRecommended ? '#000000' : '#ffffff', margin: '0 auto' }}>
                                            {subject.isRecommended && <CheckSquare style={{ width: '0.7rem', height: '0.7rem', color: '#ffffff' }} />}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.4rem', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontSize: '8px', color: '#000000' }}>
                                        {subject.gradingType}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.4rem' }}></td>
                                    </tr>
                                  );
                                })
                              ))}
                            </Fragment>
                          ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div style={{ padding: '0.8rem 1.5rem', borderTop: '1px solid #cbd5e1', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#000000', fontStyle: 'italic' }}>
                          * 본 계획서는 학생의 전공 적합성을 고려한 추천 안이며, 실제 수강 신청 시 변경될 수 있습니다.
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#000000' }}>
                          제작 : 숭신고등학교 진로진학상담부 김강석
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 border-t border-slate-200 text-center print:hidden">
                      <p className="text-xs text-slate-400">
                        * 위 체크박스는 대학별 권장 과목을 바탕으로 자동 생성되었습니다. <br />
                        * 실제 수강신청 시에는 본인의 적성과 진로 계획을 충분히 고려하시기 바랍니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            {/* Footer Note */}
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex gap-4 print:hidden">
              <Info className="text-blue-600 w-6 h-6 shrink-0" />
              <div className="text-sm text-blue-800 space-y-2">
                <p className="font-bold">안내 사항</p>
                <p>위 과목 리스트는 일반적인 권장 사항이며, 실제 학교의 교육과정 편성 현황에 따라 다를 수 있습니다.</p>
                <p>대학별로 요구하는 핵심 권장 과목이 다를 수 있으니, 목표 대학의 입학처 홈페이지를 반드시 참고하시기 바랍니다.</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-12 print:hidden">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-4">
          <div className="flex justify-center gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-900 font-bold text-lg">
              제작 : 숭신고등학교 진로진학상담부 김강석
            </p>
            <p className="text-slate-400 text-sm">
              이 자료는 학과바이들(캠퍼스멘토) 및 각 시도교육청, 대학 권장과목의 내용을 바탕으로 제작되었습니다.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom Curriculum Input Modal */}
      <AnimatePresence>
        {showCustomForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomForm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-xl text-white">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">교육과정 직접 입력</h3>
                    <p className="text-xs text-slate-500">학년별 선택 그룹과 과목을 직접 구성합니다.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCustomForm(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Mandatory Subjects Section */}
                <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-slate-800">학년별 필수 과목</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">2학년 1학기 필수</label>
                      <textarea 
                        value={tempMandatory['2-1']}
                        onChange={(e) => setTempMandatory({...tempMandatory, '2-1': e.target.value})}
                        placeholder="과목명을 쉼표(,)로 구분하여 입력"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">2학년 2학기 필수</label>
                      <textarea 
                        value={tempMandatory['2-2']}
                        onChange={(e) => setTempMandatory({...tempMandatory, '2-2': e.target.value})}
                        placeholder="과목명을 쉼표(,)로 구분하여 입력"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">3학년 1학기 필수</label>
                      <textarea 
                        value={tempMandatory['3-1']}
                        onChange={(e) => setTempMandatory({...tempMandatory, '3-1': e.target.value})}
                        placeholder="과목명을 쉼표(,)로 구분하여 입력"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">3학년 2학기 필수</label>
                      <textarea 
                        value={tempMandatory['3-2']}
                        onChange={(e) => setTempMandatory({...tempMandatory, '3-2': e.target.value})}
                        placeholder="과목명을 쉼표(,)로 구분하여 입력"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <h4 className="font-bold text-slate-800">선택 과목 그룹</h4>
                  </div>
                  <button 
                    onClick={handleAddGroup}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    추가하기
                  </button>
                </div>

                {tempGroups.map((group, index) => (
                  <div key={group.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative group">
                    <button 
                      onClick={() => handleRemoveGroup(group.id)}
                      className="absolute -top-2 -right-2 bg-white border border-slate-200 p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 ml-1">학년</label>
                        <select 
                          value={group.grade}
                          onChange={(e) => handleUpdateGroup(group.id, 'grade', parseInt(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value={2}>2학년</option>
                          <option value={3}>3학년</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 ml-1">학기</label>
                        <select 
                          value={group.semester}
                          onChange={(e) => handleUpdateGroup(group.id, 'semester', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="1학기">1학기</option>
                          <option value="2학기">2학기</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 ml-1">학점</label>
                        <input 
                          type="number"
                          value={group.credits}
                          onChange={(e) => handleUpdateGroup(group.id, 'credits', parseInt(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 ml-1">선택과목수</label>
                        <input 
                          type="number"
                          value={group.selectCount}
                          onChange={(e) => handleUpdateGroup(group.id, 'selectCount', parseInt(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 ml-1">선택과목 리스트 (쉼표로 구분)</label>
                      <textarea 
                        value={group.subjects}
                        onChange={(e) => handleUpdateGroup(group.id, 'subjects', e.target.value)}
                        placeholder="예: 물리학, 화학, 생명과학, 지구과학"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] resize-none"
                      />
                    </div>
                  </div>
                ))}

                <button 
                  onClick={handleAddGroup}
                  className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-500 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  항목 추가하기
                </button>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  onClick={() => setShowCustomForm(false)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  취소
                </button>
                <button 
                  onClick={handleDone}
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  교육과정 생성 완료
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
