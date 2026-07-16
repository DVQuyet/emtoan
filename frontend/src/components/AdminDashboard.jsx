import React, { useState, useEffect } from 'react';
import { Users, ShieldAlert, BookOpen, Trash2, Plus, Sparkles, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Eye, Database, UploadCloud, FileText } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AdminDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('students');
  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  // States cho Upload PDF
  const [activeRefDoc, setActiveRefDoc] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]); // Hỗ trợ đa file
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('active');
  
  // States cho danh sách chủ đề động
  const [dbTopics, setDbTopics] = useState([]);
  
  // States cho trích xuất chủ đề bằng AI
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  
  // States cho form chủ đề thủ công
  const [manualTopicName, setManualTopicName] = useState('');
  const [manualTopicId, setManualTopicId] = useState('');
  const [manualTopicChapter, setManualTopicChapter] = useState('');
  const [manualTopicGrade, setManualTopicGrade] = useState(12);
  const [savingManualTopic, setSavingManualTopic] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('topic');
  const [uploadTopicId, setUploadTopicId] = useState('');
  const [showQuickAddTopic, setShowQuickAddTopic] = useState(false);
  const [quickTopicName, setQuickTopicName] = useState('');
  const [quickTopicId, setQuickTopicId] = useState('');
  const [quickTopicChapter, setQuickTopicChapter] = useState('');
  const [quickTopicGrade, setQuickTopicGrade] = useState(12);
  const [savingQuickTopic, setSavingQuickTopic] = useState(false);
  
  // States cho viec gan nhanh chu de cho tai lieu da nap
  const [editingDocId, setEditingDocId] = useState(null);
  const [editDocType, setEditDocType] = useState('topic');
  const [editTopicId, setEditTopicId] = useState('');
  const [savingEditTopic, setSavingEditTopic] = useState(false);
 // ID của học sinh đang xem ma trận chi tiết
  
  // States cho form tạo đề
  const [newExamTitle, setNewExamTitle] = useState('');
  
  // States cho hiển thị tiến trình thời gian thực
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressSteps, setProgressSteps] = useState([]);

  // Helper to read NDJSON stream from response body
  const readProgressStream = async (response, onProgress, onSuccess, onError) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // giữ dòng cuối chưa xong lại buffer
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.status === 'error') {
              onError(data.error);
              return;
            } else if (data.status === 'success') {
              onSuccess(data.data);
              return;
            } else {
              onProgress(data.message, data.step);
            }
          } catch (e) {
            console.warn("Lỗi phân tích cú pháp dòng stream:", line, e);
          }
        }
      }
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.status === 'error') {
            onError(data.error);
          } else if (data.status === 'success') {
            onSuccess(data.data);
          }
        } catch (e) {
          console.warn("Lỗi phân tích cú pháp dòng stream cuối:", buffer, e);
        }
      }
    } catch (err) {
      onError(err.message);
    }
  };
  const [selectedTopic, setSelectedTopic] = useState('cuc_tri_ham_so');
  const [difficulty, setDifficulty] = useState(6);
  const [randomDifficulty, setRandomDifficulty] = useState(false);
  const [numQuestions, setNumQuestions] = useState(3);
  const [generating, setGenerating] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // 1. Tải danh sách học sinh
      const userRes = await fetch(`${API_BASE_URL}/api/users`);
      const usersData = await userRes.json();
      setUsers(usersData);

      // 2. Tải danh sách đề thi
      const examRes = await fetch(`${API_BASE_URL}/api/exams`);
      const examsData = await examRes.json();
      setExams(examsData);

      // 3. Tải danh sách bài thi & giám sát
      const attemptRes = await fetch(`${API_BASE_URL}/api/test-attempts`);
      const attemptsData = await attemptRes.json();
      // Sắp xếp mới nhất lên đầu
      setAttempts(attemptsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

      // 4. Tải tài liệu AI hiện tại
      const refRes = await fetch(`${API_BASE_URL}/api/admin/reference`);
      if (refRes.ok) {
        const refData = await refRes.json();
        setActiveRefDoc(refData);
      } else {
        setActiveRefDoc(null);
      }

      // 5. Tải danh sách tất cả tài liệu AI
      const docsRes = await fetch(`${API_BASE_URL}/api/admin/documents`);
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
      } else {
        setDocuments([]);
      }

      // 6. Tải danh sách chủ đề (Topics) từ MongoDB
      const topicsRes = await fetch(`${API_BASE_URL}/api/topics`);
      if (topicsRes.ok) {
        const topicsData = await topicsRes.json();
        setDbTopics(topicsData);
        if (topicsData.length > 0) {
          if (!uploadTopicId) setUploadTopicId(topicsData[0].topic_id);
        }
      } else {
        setDbTopics([]);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu quản trị:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Xóa đề thi
  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.")) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/exams/${examId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchAdminData();
      } else {
        alert(`Lỗi khi xóa: ${data.error}`);
      }
    } catch (error) {
      console.error("Lỗi kết nối xóa đề:", error);
    }
  };

  // AI sinh đề thi (Gemini)
  const handleCreateAIExam = async (e) => {
    e.preventDefault();
    try {
      setProgressTitle("Đang biên soạn đề thi Toán thích ứng bằng AI...");
      setProgressSteps([
        { step: 'init', message: 'Bắt đầu quá trình khởi tạo sinh đề thi Toán...', status: 'pending' },
        { step: 'load_docs', message: 'Đang tải tài liệu ôn tập và ngữ cảnh tham chiếu...', status: 'pending' },
        { step: 'prepare_prompt', message: 'Đang xây dựng prompt chuẩn hóa độ khó toán học...', status: 'pending' },
        { step: 'call_ai', message: 'Đang gửi yêu cầu biên soạn câu hỏi tới mô hình AI (khoảng 5-15 giây)...', status: 'pending' },
        { step: 'parse_json', message: 'Đang phân tích cú pháp dữ liệu câu hỏi từ AI...', status: 'pending' },
        { step: 'save_questions', message: 'Đang lưu các câu hỏi mới và phân tích đáp án vào cơ sở dữ liệu...', status: 'pending' },
        { step: 'save_exam', message: 'Đang khởi tạo cấu trúc đề thi thích ứng...', status: 'pending' }
      ]);
      setShowProgressModal(true);

      const res = await fetch(`${API_BASE_URL}/api/exams/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newExamTitle || `Đề thích ứng AI - Chủ đề ${selectedTopic.replace(/_/g, ' ')}`,
          topicId: selectedTopic,
          difficulty: randomDifficulty ? 'random' : parseInt(difficulty),
          numQuestions: parseInt(numQuestions),
          documentId: selectedDocId,
          stream: true
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi kết nối máy chủ khi sinh đề.');
      }

      await readProgressStream(
        res,
        (msg, stepCode) => {
          setProgressSteps(prev => prev.map(s => {
            if (s.step === stepCode) {
              return { ...s, status: 'loading', message: msg };
            }
            const currentIdx = prev.findIndex(item => item.step === stepCode);
            const thisIdx = prev.findIndex(item => item.step === s.step);
            if (thisIdx < currentIdx && s.status !== 'success') {
              return { ...s, status: 'success' };
            }
            return s;
          }));
        },
        (data) => {
          setProgressSteps(prev => prev.map(s => ({ ...s, status: 'success' })));
          setNewExamTitle('');
          fetchAdminData();
        },
        (err) => {
          setProgressSteps(prev => {
            let errorMarked = false;
            return prev.map(s => {
              if (s.status === 'loading' || (!errorMarked && s.status === 'pending')) {
                errorMarked = true;
                return { ...s, status: 'error', message: `Lỗi: ${err}` };
              }
              return s;
            });
          });
        }
      );
    } catch (error) {
      console.error("Lỗi kết nối AI sinh đề:", error);
      setProgressSteps(prev => [
        ...prev,
        { step: 'error', message: `Lỗi kết nối: ${error.message}`, status: 'error' }
      ]);
    }
  };


  // Upload PDF
  const handleUploadPdf = async (e) => {
    e.preventDefault();
    if (!pdfFile) return alert("Vui lòng chọn một tệp PDF.");

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('docType', uploadDocType);
    formData.append('topicId', uploadDocType === 'general_exam' ? '' : uploadTopicId);

    try {
      setProgressTitle("Đang nạp tài liệu tham khảo & OCR ảnh quét...");
      setProgressSteps([
        { step: 'upload', message: 'Tải lên tệp và bắt đầu trích xuất...', status: 'pending' },
        { step: 'pdf_parse', message: 'Đang phân tích cấu trúc tệp PDF kỹ thuật số (pdf-parse)...', status: 'pending' },
        { step: 'ocr_start', message: 'Đang kiểm tra chất lượng và chạy OCR fallback nếu cần...', status: 'pending' },
        { step: 'save_db', message: 'Đang lưu tài liệu và cập nhật cơ sở dữ liệu...', status: 'pending' }
      ]);
      setShowProgressModal(true);

      const res = await fetch(`${API_BASE_URL}/api/admin/upload-reference?stream=true`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi kết nối máy chủ khi nạp tệp.');
      }

      await readProgressStream(
        res,
        (msg, stepCode) => {
          setProgressSteps(prev => prev.map(s => {
            if (s.step === stepCode || (stepCode === 'pdf_parse_success' && s.step === 'pdf_parse') || (stepCode === 'ocr_gemini' && s.step === 'ocr_start') || (stepCode === 'ocr_success' && s.step === 'ocr_start')) {
              return { ...s, status: 'loading', message: msg };
            }
            const currentIdx = prev.findIndex(item => item.step === stepCode);
            let mappedIdx = currentIdx;
            if (stepCode === 'pdf_parse_success') mappedIdx = prev.findIndex(item => item.step === 'pdf_parse');
            if (stepCode === 'ocr_gemini' || stepCode === 'ocr_success' || stepCode === 'ocr_start') mappedIdx = prev.findIndex(item => item.step === 'ocr_start');

            const thisIdx = prev.findIndex(item => item.step === s.step);
            if (thisIdx < mappedIdx && s.status !== 'success') {
              return { ...s, status: 'success' };
            }
            return s;
          }));
        },
        (data) => {
          setProgressSteps(prev => prev.map(s => ({ ...s, status: 'success' })));
          setPdfFile(null);
          setPdfFiles([]);
          const fileInput = document.getElementById('pdfFileInput');
          if (fileInput) fileInput.value = '';
          const multiInput = document.getElementById('multiPdfFileInput');
          if (multiInput) multiInput.value = '';
          fetchAdminData();
        },
        (err) => {
          setProgressSteps(prev => {
            let errorMarked = false;
            return prev.map(s => {
              if (s.status === 'loading' || (!errorMarked && s.status === 'pending')) {
                errorMarked = true;
                return { ...s, status: 'error', message: `Lỗi: ${err}` };
              }
              return s;
            });
          });
        }
      );
    } catch (error) {
      console.error("Lỗi khi tải lên PDF:", error);
      setProgressSteps(prev => [
        ...prev,
        { step: 'error', message: `Lỗi kết nối: ${error.message}`, status: 'error' }
      ]);
    }
  };
  
  // Delete PDF
  const handleDeletePdf = async (docId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu ngữ cảnh này? AI sẽ không còn ngữ cảnh chuyên môn.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reference/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert("Đã xóa tài liệu.");
        fetchAdminData();
      }
    } catch (error) {
      console.error("Lỗi xóa tài liệu:", error);
    }
  };

  // Đặt làm tài liệu mặc định
  const handleSetActivePdf = async (docId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reference/${docId}/active`, {
        method: 'PUT'
      });
      if (res.ok) {
        alert("Đã cập nhật trạng thái nạp của tài liệu.");
        fetchAdminData();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch (error) {
      console.error("Lỗi đặt tài liệu hoạt động:", error);
    }
  };

  // Phân tích chủ đề từ nhiều PDF bằng AI
  const handleAnalyzeTopics = async (e) => {
    e.preventDefault();
    if (pdfFiles.length === 0) return alert("Vui lòng chọn ít nhất một tệp PDF.");

    const formData = new FormData();
    for (const file of pdfFiles) {
      formData.append('pdfs', file);
    }

    try {
      setProgressTitle("AI đang quét và đề xuất chủ đề thi từ các tệp PDF...");
      setProgressSteps([
        { step: 'init', message: 'Bắt đầu quét và phân tích tệp PDF...', status: 'pending' },
        { step: 'parse_0', message: 'Đang trích xuất văn bản từ các tệp PDF kỹ thuật số...', status: 'pending' },
        { step: 'call_ai', message: 'Đang phân tích cấu trúc chương trình và trích xuất chủ đề thi...', status: 'pending' }
      ]);
      setShowProgressModal(true);

      const res = await fetch(`${API_BASE_URL}/api/admin/analyze-topics?stream=true`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi kết nối máy chủ khi quét chủ đề.');
      }

      await readProgressStream(
        res,
        (msg, stepCode) => {
          setProgressSteps(prev => prev.map(s => {
            const isParseStep = stepCode.startsWith('parse_');
            if (s.step === stepCode || (isParseStep && s.step === 'parse_0')) {
              return { ...s, status: 'loading', message: msg };
            }
            const currentIdx = prev.findIndex(item => item.step === stepCode);
            let mappedIdx = currentIdx;
            if (isParseStep) mappedIdx = prev.findIndex(item => item.step === 'parse_0');

            const thisIdx = prev.findIndex(item => item.step === s.step);
            if (thisIdx < mappedIdx && s.status !== 'success') {
              return { ...s, status: 'success' };
            }
            return s;
          }));
        },
        (data) => {
          setProgressSteps(prev => prev.map(s => ({ ...s, status: 'success' })));
          setSuggestedTopics(data);
          const initialSelections = {};
          data.forEach(t => {
            initialSelections[t.topic_id] = true;
          });
          setSelectedSuggestions(initialSelections);
        },
        (err) => {
          setProgressSteps(prev => {
            let errorMarked = false;
            return prev.map(s => {
              if (s.status === 'loading' || (!errorMarked && s.status === 'pending')) {
                errorMarked = true;
                return { ...s, status: 'error', message: `Lỗi: ${err}` };
              }
              return s;
            });
          });
        }
      );
    } catch (error) {
      console.error("Lỗi phân tích chủ đề:", error);
      setProgressSteps(prev => [
        ...prev,
        { step: 'error', message: `Lỗi kết nối: ${error.message}`, status: 'error' }
      ]);
    }
  };

  // Lưu các chủ đề gợi ý được chọn
  const handleSaveSuggestedTopics = async () => {
    const topicsToSave = suggestedTopics.filter(t => selectedSuggestions[t.topic_id]);
    if (topicsToSave.length === 0) return alert("Vui lòng chọn ít nhất một chủ đề để lưu.");

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/topics/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: topicsToSave })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSuggestedTopics([]);
        fetchAdminData();
      } else {
        alert(`Lỗi lưu chủ đề: ${data.error}`);
      }
    } catch (error) {
      console.error("Lỗi lưu chủ đề:", error);
    }
  };

  // Lưu chủ đề tạo thủ công
  const handleSaveManualTopic = async (e) => {
    e.preventDefault();
    if (!manualTopicName || !manualTopicId || !manualTopicChapter) {
      return alert("Vui lòng nhập đầy đủ thông tin chủ đề.");
    }

    setSavingManualTopic(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualTopicName,
          topic_id: manualTopicId,
          chapter: manualTopicChapter,
          grade: manualTopicGrade
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setManualTopicName('');
        setManualTopicId('');
        setManualTopicChapter('');
        setManualTopicGrade(12);
        fetchAdminData();
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch (error) {
      console.error("Lỗi thêm chủ đề:", error);
    } finally {
      setSavingManualTopic(false);
    }
  };

  // Xóa chủ đề
  const handleDeleteTopic = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa chủ đề này khỏi hệ thống? Các đề thi thuộc chủ đề này vẫn giữ nguyên.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/topics/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert("Đã xóa chủ đề thành công.");
        fetchAdminData();
      } else {
        const data = await res.json();
        alert(`Lỗi: ${data.error}`);
      }
    } catch (error) {
      console.error("Lỗi xóa chủ đề:", error);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '0.5rem' }}>
        <RefreshCw className="animate-spin" /> Đang tải thông tin quản trị...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Navbar con của Admin */}
      <div className="glass-panel admin-nav-bar" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem' }}>
        <button 
          className={`nav-tab ${activeSubTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('students')}
        >
          <Users size={16} />
          Học sinh & Năng lực
        </button>
        
        <button 
          className={`nav-tab ${activeSubTab === 'cheats' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('cheats')}
        >
          <ShieldAlert size={16} />
          Nhật ký Giám sát Gian lận
        </button>
        
        <button 
          className={`nav-tab ${activeSubTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('exams')}
        >
          <BookOpen size={16} />
          Thiết lập Đề thi
        </button>
        
        <button 
          className={`nav-tab ${activeSubTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('knowledge')}
        >
          <Database size={16} />
          Kho Dữ liệu AI
        </button>
      </div>

      {/* TẬP 1: DANH SÁCH HỌC SINH */}
      {activeSubTab === 'students' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users style={{ color: 'var(--primary)' }} />
            Danh sách Học sinh
          </h3>
          <p style={{ marginBottom: '1.5rem' }}>Bấm vào từng học sinh để xem chi tiết Ma trận kiến thức năng lực do AI đánh giá.</p>
          
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Tên học sinh</th>
                  <th>Email</th>
                  <th>Khối lớp</th>
                  <th>Số đề thi đã làm</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isExpanded = expandedUser === u._id;
                  return (
                    <React.Fragment key={u._id}>
                      <tr>
                        <td style={{ fontWeight: '700' }}>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td>Khối {u.grade_level}</td>
                        <td>{u.total_tests_taken} bài</td>
                        <td>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => setExpandedUser(isExpanded ? null : u._id)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? ' Ẩn ma trận' : ' Xem ma trận'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="5" style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                              {Object.entries(u.knowledge_matrix || {}).map(([topic, score]) => {
                                let badgeColor = 'badge-danger';
                                if (score >= 5 && score < 8) badgeColor = 'badge-warning';
                                if (score >= 8) badgeColor = 'badge-success';
                                
                                return (
                                  <div key={topic} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{topic.replace(/_/g, ' ')}</span>
                                    <span className={`badge ${badgeColor}`}>{score.toFixed(1)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TẬP 2: NHẬT KÝ GIÁM SÁT GIAN LẬN TẬP TRUNG */}
      {activeSubTab === 'cheats' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert style={{ color: 'var(--warning)' }} />
            Hệ thống Giám sát Chống gian lận Tập trung
          </h3>
          <p style={{ marginBottom: '1.5rem' }}>Xem chi tiết lịch sử và các nhật ký vi phạm (chuyển tab, thoát fullscreen) của học sinh khi làm bài.</p>
          
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Đề thi</th>
                  <th>Điểm số</th>
                  <th>Chuyển tab</th>
                  <th>Thoát Fullscreen</th>
                  <th>Đánh giá gian lận</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const switches = a.anti_cheat_logs?.tab_switch_count || 0;
                  const exits = a.anti_cheat_logs?.fullscreen_exit_count || 0;
                  const totalCheats = switches + exits;
                  const suspiciousFlags = a.anti_cheat_logs?.suspicious_flags || [];

                  return (
                    <React.Fragment key={a._id}>
                      <tr>
                        <td style={{ fontWeight: '700' }}>{a.user_id?.full_name || 'Học sinh ẩn'}</td>
                        <td>{a.exam_id?.title || 'Đề thi đã sinh'}</td>
                        <td style={{ fontWeight: '800' }}>{a.result_summary?.total_score.toFixed(1)}</td>
                        <td style={{ color: switches > 0 ? 'var(--danger)' : 'inherit' }}>{switches} lần</td>
                        <td style={{ color: exits > 0 ? 'var(--danger)' : 'inherit' }}>{exits} lần</td>
                        <td>
                          {totalCheats === 0 ? (
                            <span className="badge badge-success">An toàn</span>
                          ) : totalCheats <= 2 ? (
                            <span className="badge badge-warning">Nghi ngờ</span>
                          ) : (
                            <span className="badge badge-danger">Cảnh báo cao</span>
                          )}
                        </td>
                      </tr>
                      {suspiciousFlags.length > 0 && (
                        <tr>
                          <td colSpan="6" style={{ background: 'rgba(239, 68, 68, 0.02)', padding: '0.75rem 1.5rem', borderLeft: '3px solid var(--danger)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--danger)', marginBottom: '0.4rem' }}>Nhật ký hoạt động nghi vấn:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {suspiciousFlags.map((flag, idx) => (
                                <div key={idx} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>• {flag}</div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TẬP 3: THIẾT LẬP ĐỀ THI & AI GENERATOR */}
      {activeSubTab === 'exams' && (
        <div className="admin-exams-grid">
          
          {/* Form Sinh Đề Thi AI */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles style={{ color: 'var(--secondary)' }} />
              Sinh Đề Thi Toán AI (Gemini)
            </h3>
            
            <form onSubmit={handleCreateAIExam} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600' }}>Tiêu đề đề thi</label>
                <input 
                  type="text" 
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Nhập tiêu đề đề thi tự chọn..."
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600' }}>Chọn chủ đề khảo sát</label>
                <select 
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                >
                  {dbTopics.map((t) => (
                    <option key={t._id} value={t.topic_id}>
                      {t.name} ({t.chapter} - Lớp {t.grade})
                    </option>
                  ))}
                  {dbTopics.length === 0 && <option value="">Không có chủ đề nào. Vui lòng thêm chủ đề!</option>}
                </select>
              </div>



              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600' }}>Độ khó mục tiêu (1-10)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="10"
                    className="chat-input"
                    style={{ width: '100%', opacity: randomDifficulty ? 0.5 : 1 }}
                    value={difficulty}
                    disabled={randomDifficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  />
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input 
                      type="checkbox"
                      id="randomDifficultyCheck"
                      checked={randomDifficulty}
                      onChange={(e) => setRandomDifficulty(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="randomDifficultyCheck" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                      Phân bổ chuẩn (40% NB, 30% TH, 20% VD, 10% VDC)
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600' }}>Số câu hỏi sinh ra</label>
                  <input 
                    type="number" 
                    min="1"
                    max="30"
                    className="chat-input"
                    style={{ width: '100%' }}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                disabled={generating}
              >
                <Sparkles size={16} />
                {generating ? 'AI đang biên soạn đề thi...' : 'Yêu cầu Gemini biên soạn đề thi Toán'}
              </button>
            </form>
          </div>

          {/* Quản lý Đề Thi Hiện Có */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen style={{ color: 'var(--primary)' }} />
              Quản lý Đề Thi
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
              {exams.map((exam) => (
                <div 
                  key={exam._id} 
                  style={{ 
                    padding: '1rem', 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '10px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}
                >
                  <div>
                    <h5 style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: '700', marginBottom: '0.2rem' }}>{exam.title}</h5>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {exam.time_limit_minutes} phút | {exam.questions?.length || 0} câu hỏi
                    </div>
                  </div>
                  <button 
                    className="btn btn-outline"
                    style={{ padding: '0.5rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    onClick={() => handleDeleteExam(exam._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TẬP 4: KHO DỮ LIỆU AI & QUẢN LÝ CHỦ ĐỀ */}
      {activeSubTab === 'knowledge' && (
        <div className="admin-knowledge-grid">
          
          {/* CỘT TRÁI: TẢI LÊN & TRÍCH XUẤT CHỦ ĐỀ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Tải lên và phân tích chủ đề */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud style={{ color: 'var(--primary)' }} />
                Phân tích & Tải lên tài liệu PDF
              </h3>
              <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Bạn có thể chọn 1 file để nạp ngữ cảnh cho AI, hoặc chọn **nhiều file PDF cùng lúc** để AI phân tích và tự động đề xuất các chủ đề thi tương ứng.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ border: '2px dashed var(--panel-border)', padding: '2rem 1rem', textAlign: 'center', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                  <input 
                    id="multiPdfFileInput"
                    type="file" 
                    multiple
                    accept="application/pdf"
                    onChange={(e) => {
                      setPdfFiles(Array.from(e.target.files));
                      if (e.target.files.length > 0) {
                        setPdfFile(e.target.files[0]); // Đặt tệp đầu tiên làm tệp đơn
                      }
                    }}
                    style={{ display: 'block', margin: '0 auto', color: 'var(--text-muted)' }}
                  />
                  {pdfFiles.length > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600' }}>
                      Đang chọn {pdfFiles.length} tệp PDF
                    </div>
                  )}
                </div>

                {/* Chọn phân loại và chủ đề khi nạp file */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Loại tài liệu</label>
                    <select 
                      className="chat-input"
                      style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                    >
                      <option value="topic">Tài liệu theo chủ đề</option>
                      <option value="general_exam">Đề thi thử THPT Quốc gia (Tổng hợp)</option>
                    </select>
                  </div>
                  {uploadDocType === 'topic' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Gán sẵn chủ đề</label>
                      <select 
                        className="chat-input"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={uploadTopicId}
                        onChange={(e) => {
                          if (e.target.value === 'NEW_TOPIC') {
                            setShowQuickAddTopic(true);
                          } else {
                            setUploadTopicId(e.target.value);
                            setShowQuickAddTopic(false);
                          }
                        }}
                      >
                        {dbTopics.map((t) => (
                          <option key={t._id} value={t.topic_id}>
                            {t.name}
                          </option>
                        ))}
                        <option value="NEW_TOPIC">+ Thêm chủ đề mới...</option>
                      </select>
                    </div>
                  )}

                  {/* Form Tạo nhanh chủ đề ngay khi nạp file */}
                  {uploadDocType === 'topic' && showQuickAddTopic && (
                    <div style={{ 
                      gridColumn: 'span 2', 
                      background: 'rgba(255,255,255,0.03)', 
                      padding: '0.75rem', 
                      borderRadius: '6px', 
                      border: '1px dashed var(--secondary)',
                      marginTop: '0.25rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem' 
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>Tạo nhanh chủ đề mới</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          placeholder="Tên (VD: Hàm số mũ)" 
                          className="chat-input" 
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          value={quickTopicName}
                          onChange={(e) => setQuickTopicName(e.target.value)}
                        />
                        <input 
                          type="text" 
                          placeholder="Mã (VD: ham_so_mu)" 
                          className="chat-input" 
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          value={quickTopicId}
                          onChange={(e) => setQuickTopicId(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          placeholder="Chương (VD: Hàm số Lũy thừa)" 
                          className="chat-input" 
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          value={quickTopicChapter}
                          onChange={(e) => setQuickTopicChapter(e.target.value)}
                        />
                        <select 
                          className="chat-input" 
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          value={quickTopicGrade}
                          onChange={(e) => setQuickTopicGrade(parseInt(e.target.value))}
                        >
                          <option value={10}>Lớp 10</option>
                          <option value={11}>Lớp 11</option>
                          <option value={12}>Lớp 12</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                        <button 
                          type="button" 
                          className="btn btn-outline" 
                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => {
                            setShowQuickAddTopic(false);
                            if (dbTopics.length > 0) setUploadTopicId(dbTopics[0].topic_id);
                          }}
                        >
                          Hủy
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-primary" 
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                          disabled={savingQuickTopic}
                          onClick={async () => {
                            if (!quickTopicName || !quickTopicId || !quickTopicChapter) {
                              return alert("Vui lòng điền đầy đủ thông tin.");
                            }
                            setSavingQuickTopic(true);
                            try {
                              const res = await fetch(`${API_BASE_URL}/api/admin/topics`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  name: quickTopicName,
                                  topic_id: quickTopicId,
                                  chapter: quickTopicChapter,
                                  grade: quickTopicGrade
                                })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                alert("Đã tạo chủ đề thành công!");
                                setQuickTopicName('');
                                setQuickTopicId('');
                                setQuickTopicChapter('');
                                setQuickTopicGrade(12);
                                setShowQuickAddTopic(false);
                                
                                // Tải lại danh sách chủ đề
                                const tRes = await fetch(`${API_BASE_URL}/api/topics`);
                                if (tRes.ok) {
                                  const tData = await tRes.json();
                                  setDbTopics(tData);
                                }
                                setUploadTopicId(quickTopicId);
                              } else {
                                alert(`Lỗi: ${data.error}`);
                              }
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setSavingQuickTopic(false);
                            }
                          }}
                        >
                          {savingQuickTopic ? 'Đang tạo...' : 'Tạo & Chọn'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-outline"
                    disabled={uploadingPdf || pdfFiles.length === 0}
                    onClick={handleUploadPdf}
                    style={{ justifyContent: 'center' }}
                  >
                    {uploadingPdf ? 'Đang nạp...' : 'Nạp làm ngữ cảnh'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={analyzing || pdfFiles.length === 0}
                    onClick={handleAnalyzeTopics}
                    style={{ justifyContent: 'center' }}
                  >
                    {analyzing ? 'AI đang phân tích...' : 'AI quét chủ đề thi'}
                  </button>
                </div>
              </div>
            </div>

            {/* Hiển thị chủ đề AI gợi ý */}
            {suggestedTopics.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                  <Sparkles size={18} />
                  Các chủ đề đề xuất từ AI
                </h3>
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                  AI đã phân tích nội dung PDF và tìm thấy các chủ đề sau. Hãy tích chọn các chủ đề bạn muốn thêm vào thư viện:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '0.5rem' }}>
                  {suggestedTopics.map((topic) => (
                    <label 
                      key={topic.topic_id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.6rem 0.8rem', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: '6px', 
                        border: '1px solid var(--panel-border)',
                        cursor: 'pointer'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={!!selectedSuggestions[topic.topic_id]} 
                        onChange={(e) => {
                          setSelectedSuggestions(prev => ({
                            ...prev,
                            [topic.topic_id]: e.target.checked
                          }));
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>{topic.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Chương: {topic.chapter} | Lớp {topic.grade} | Mã: {topic.topic_id}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => setSuggestedTopics([])}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    Bỏ qua
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSaveSuggestedTopics}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                  >
                    Thêm các chủ đề đã chọn
                  </button>
                </div>
              </div>
            )}

            {/* Thêm chủ đề thủ công */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus style={{ color: 'var(--secondary)' }} size={18} />
                Thêm chủ đề thủ công
              </h3>
              
              <form onSubmit={handleSaveManualTopic} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Tên chủ đề</label>
                    <input 
                      type="text" 
                      className="chat-input"
                      style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      placeholder="VD: Phương trình mặt cầu"
                      value={manualTopicName}
                      onChange={(e) => setManualTopicName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Mã chủ đề (topic_id)</label>
                    <input 
                      type="text" 
                      className="chat-input"
                      style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      placeholder="VD: phuong_trinh_mat_cau"
                      value={manualTopicId}
                      onChange={(e) => setManualTopicId(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Thuộc chương học</label>
                    <input 
                      type="text" 
                      className="chat-input"
                      style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      placeholder="VD: Phương pháp tọa độ Oxyz"
                      value={manualTopicChapter}
                      onChange={(e) => setManualTopicChapter(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Khối lớp</label>
                    <select 
                      className="chat-input"
                      style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={manualTopicGrade}
                      onChange={(e) => setManualTopicGrade(parseInt(e.target.value))}
                    >
                      <option value={10}>Lớp 10</option>
                      <option value={11}>Lớp 11</option>
                      <option value={12}>Lớp 12</option>
                    </select>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', padding: '0.5rem' }}
                  disabled={savingManualTopic}
                >
                  {savingManualTopic ? 'Đang lưu...' : 'Thêm chủ đề này'}
                </button>
              </form>
            </div>

          </div>

                    {/* CỘT PHẢI: QUẢN LÝ TÀI LIỆU & QUẢN LÝ CHỦ ĐỀ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Thư viện tài liệu */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database style={{ color: 'var(--primary)' }} />
                Thư viện Tài liệu ({documents.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                Nhóm tài liệu theo chủ đề học tập. Tài liệu nào nạp cho AI sẽ có ký hiệu <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✔ (V)</span>, ngược lại ký hiệu <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>✘ (X)</span>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '220px', paddingRight: '0.25rem' }}>
                {(() => {
                  // Gom nhóm tài liệu động theo chủ đề từ CSDL
                  const groups = {};
                  
                  // 1. Nhóm Đề thi thử THPT Quốc gia
                  const generalDocs = documents.filter(d => d.doc_type === 'general_exam');
                  if (generalDocs.length > 0) {
                    groups['general_exam'] = {
                      name: 'Đề thi thử THPT Quốc gia (Tổng hợp)',
                      docs: generalDocs,
                      isGeneral: true
                    };
                  }

                  // 2. Nhóm theo từng chủ đề có tài liệu
                  dbTopics.forEach(t => {
                    const tDocs = documents.filter(d => {
                      const type = d.doc_type || 'topic';
                      return type === 'topic' && d.topic_id === t.topic_id;
                    });
                    if (tDocs.length > 0) {
                      groups[t.topic_id] = {
                        name: t.name + ' (Khối ' + t.grade + ')',
                        docs: tDocs,
                        isGeneral: false
                      };
                    }
                  });

                  // 3. Nhóm tài liệu chưa phân loại (các file cũ chưa gắn chủ đề hoặc loại)
                  const unclassifiedDocs = documents.filter(d => {
                    const type = d.doc_type || 'topic';
                    if (type === 'general_exam') return false;
                    return !d.topic_id || !dbTopics.some(t => t.topic_id === d.topic_id);
                  });
                  if (unclassifiedDocs.length > 0) {
                    groups['unclassified'] = {
                      name: 'Tài liệu chưa phân loại',
                      docs: unclassifiedDocs,
                      isGeneral: false
                    };
                  }

                  const groupEntries = Object.entries(groups);
                  if (groupEntries.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '0.85rem' }}>Chưa có tài liệu nào trong thư viện.</p>
                      </div>
                    );
                  }

                  return groupEntries.map(([groupId, group]) => (
                    <div key={groupId} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                      <h4 style={{ fontSize: '0.825rem', color: group.isGeneral ? 'var(--secondary)' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '700' }}>
                        {group.isGeneral ? <FileText size={14} /> : <BookOpen size={14} />}
                        {group.name} ({group.docs.length})
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: '0.4rem' }}>
                        {group.docs.map((doc) => (
                          <div 
                            key={doc._id} 
                            style={{ 
                              padding: '0.5rem 0.6rem', 
                              background: doc.isActive ? 'rgba(79, 70, 229, 0.05)' : 'rgba(255,255,255,0.01)', 
                              borderRadius: '6px', 
                              border: doc.isActive ? '1px solid var(--primary)' : '1px solid var(--panel-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem'
                            }}
                          >
                            {editingDocId === doc._id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                                <div style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Gán chủ đề: {doc.title}
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                  <select 
                                    className="chat-input" 
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', flex: 1 }}
                                    value={editDocType}
                                    onChange={(e) => setEditDocType(e.target.value)}
                                  >
                                    <option value="topic">Theo chủ đề</option>
                                    <option value="general_exam">Đề thi thử THPT</option>
                                  </select>
                                  {editDocType === 'topic' && (
                                    <select 
                                      className="chat-input" 
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', flex: 1.5 }}
                                      value={editTopicId}
                                      onChange={(e) => setEditTopicId(e.target.value)}
                                    >
                                      {dbTopics.map(t => (
                                        <option key={t._id} value={t.topic_id}>{t.name}</option>
                                      ))}
                                      {dbTopics.length === 0 && <option value="">Chưa có chủ đề nào</option>}
                                    </select>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                  <button 
                                    type="button" 
                                    className="btn btn-outline" 
                                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                                    onClick={() => setEditingDocId(null)}
                                  >
                                    Hủy
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn btn-primary" 
                                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                                    disabled={savingEditTopic}
                                    onClick={async () => {
                                      setSavingEditTopic(true);
                                      try {
                                        const res = await fetch(`${API_BASE_URL}/api/admin/reference/${doc._id}/classify`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            docType: editDocType,
                                            topicId: editDocType === 'general_exam' ? '' : editTopicId
                                          })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                          alert("Đã cập nhật tài liệu thành công!");
                                          setEditingDocId(null);
                                          fetchAdminData();
                                        } else {
                                          alert("Lỗi: " + data.error);
                                        }
                                      } catch (err) {
                                        console.error(err);
                                      } finally {
                                        setSavingEditTopic(false);
                                      }
                                    }}
                                  >
                                    Lưu
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                                  {doc.isActive ? (
                                    <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }} title="Đang nạp cho AI">
                                      ✔ <span style={{ fontSize: '0.65rem', fontWeight: 'normal', opacity: 0.8 }}>(V)</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }} title="Chưa nạp cho AI">
                                      ✘ <span style={{ fontSize: '0.65rem', fontWeight: 'normal', opacity: 0.8 }}>(X)</span>
                                    </span>
                                  )}
                                  <h5 style={{ fontSize: '0.8rem', fontWeight: '500', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.title}>
                                    {doc.title}
                                  </h5>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
                                  <button 
                                    className="btn btn-outline"
                                    style={{ padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                                    onClick={() => {
                                      setEditingDocId(doc._id);
                                      setEditDocType(doc.doc_type || 'topic');
                                      setEditTopicId(doc.topic_id || (dbTopics.length > 0 ? dbTopics[0].topic_id : ''));
                                    }}
                                  >
                                    Gán
                                  </button>
                                  {doc.isActive ? (
                                    <button 
                                      className="btn btn-outline"
                                      style={{ padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                                      onClick={() => handleSetActivePdf(doc._id)}
                                    >
                                      Hủy nạp
                                    </button>
                                  ) : (
                                    <button 
                                      className="btn btn-outline"
                                      style={{ padding: '0.15rem 0.3rem', fontSize: '0.65rem' }}
                                      onClick={() => handleSetActivePdf(doc._id)}
                                    >
                                      Nạp cho AI
                                    </button>
                                  )}
                                  <button 
                                    className="btn btn-outline"
                                    style={{ padding: '0.15rem 0.3rem', fontSize: '0.65rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                    onClick={() => handleDeletePdf(doc._id)}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Quản lý chủ đề trong hệ thống */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen style={{ color: 'var(--secondary)' }} />
                Danh mục Chủ đề thi ({dbTopics.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                Đây là danh sách các chủ đề hiện có trong cơ sở dữ liệu để giáo viên lựa chọn khi ra đề.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '300px', paddingRight: '0.25rem' }}>
                {dbTopics.length > 0 ? (
                  dbTopics.map((topic) => (
                    <div 
                      key={topic._id} 
                      style={{ 
                        padding: '0.75rem', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: '8px', 
                        border: '1px solid var(--panel-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <h5 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem' }}>{topic.name}</h5>
                        <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          Chương: {topic.chapter} | Lớp {topic.grade} | Mã: {topic.topic_id}
                        </p>
                      </div>
                      <button 
                        className="btn btn-outline"
                        style={{ padding: '0.3rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.15)', flexShrink: 0 }}
                        onClick={() => handleDeleteTopic(topic._id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.8rem' }}>Chưa có chủ đề nào trong hệ thống. Hãy tải PDF lên để quét hoặc tự thêm thủ công!</p>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}


      {/* Hộp thoại Tiến trình thời gian thực (Progress Modal) */}
      {showProgressModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff', fontWeight: 'bold', fontSize: '1.1rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem', margin: 0 }}>
              <Sparkles className="animate-pulse" style={{ color: 'var(--secondary)' }} size={20} />
              {progressTitle}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {progressSteps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
                  {step.status === 'success' && (
                    <span style={{ 
                      color: 'var(--success)', 
                      fontWeight: 'bold', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      borderRadius: '50%', 
                      width: '20px', 
                      height: '20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>✓</span>
                  )}
                  {step.status === 'loading' && (
                    <span className="animate-spin" style={{ 
                      color: 'var(--secondary)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '20px', 
                      height: '20px',
                      flexShrink: 0
                    }}>⚙</span>
                  )}
                  {step.status === 'error' && (
                    <span style={{ 
                      color: 'var(--danger)', 
                      fontWeight: 'bold', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      borderRadius: '50%', 
                      width: '20px', 
                      height: '20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>✗</span>
                  )}
                  {step.status === 'pending' && (
                    <span style={{ 
                      color: 'var(--text-muted)', 
                      border: '1px solid var(--panel-border)', 
                      borderRadius: '50%', 
                      width: '20px', 
                      height: '20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>○</span>
                  )}
                  <div style={{ flex: 1, color: step.status === 'pending' ? 'var(--text-muted)' : (step.status === 'error' ? 'var(--danger)' : '#ffffff') }}>
                    <span style={{ fontWeight: step.status === 'loading' ? '700' : 'normal' }}>{step.message}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button 
                className="btn btn-outline"
                disabled={progressSteps.some(s => s.status === 'loading')}
                onClick={() => setShowProgressModal(false)}
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
