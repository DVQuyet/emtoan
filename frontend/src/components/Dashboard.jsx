import React, { useState, useEffect } from 'react';
import { BookOpen, Award, ShieldAlert, Sparkles, RefreshCw, Calendar, Clock, AlertTriangle, Library, BookOpenCheck } from 'lucide-react';
import MathText from './MathText';
import { API_BASE_URL } from '../config';

export default function Dashboard({ userId, onStartExam, activeAttemptId }) {
  const [user, setUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // States cho Thư viện kiến thức AI
  const [activeTab, setActiveTab] = useState('home'); // 'home' hoặc 'wiki'
  const [topics, setTopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [summaryContent, setSummaryContent] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

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
            } else if (data.status === 'success' && data.data !== undefined) {
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
          } else if (data.status === 'success' && data.data !== undefined) {
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Lấy thông tin user Nguyễn Văn A (đã có từ seed data)
      const userRes = await fetch(`${API_BASE_URL}/api/users`);
      const users = await userRes.json();
      if (users && users.length > 0) {
        const activeUser = users.find(u => u._id === userId) || users[0];
        setUser(activeUser);
      }

      // Lấy danh sách đề thi
      const examRes = await fetch(`${API_BASE_URL}/api/exams`);
      const examsData = await examRes.json();
      setExams(examsData);

      // Lấy lịch sử làm bài thi
      const historyRes = await fetch(`${API_BASE_URL}/api/test-attempts`);
      const historyData = await historyRes.json();
      // Lọc các attempt của học sinh hiện tại và sắp xếp mới nhất lên đầu
      if (users && users.length > 0) {
        const activeUserId = userId || users[0]._id;
        const userHistory = historyData
          .filter(h => h.user_id && h.user_id._id === activeUserId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHistory(userHistory);
      }

      // Tải danh sách chủ đề động từ MongoDB
      const topicsRes = await fetch(`${API_BASE_URL}/api/topics`);
      if (topicsRes.ok) {
        const topicsData = await topicsRes.json();
        setTopics(topicsData);
        if (topicsData.length > 0 && !selectedTopicId) {
          setSelectedTopicId(topicsData[0].topic_id);
        }
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeAttemptId]);

  // Tra cứu tổng hợp kiến thức từ AI
  const handleLoadSummary = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTopicId) return;

    setLoadingSummary(true);
    try {
      setProgressTitle("AI đang tổng hợp tài liệu kiến thức cốt lõi...");
      setProgressSteps([
        { step: 'init', message: 'Bắt đầu lấy tài liệu tổng hợp kiến thức chủ đề...', status: 'pending' },
        { step: 'call_ai', message: 'Yêu cầu AI (Gemini) biên soạn tài liệu kiến thức cốt lõi/công thức/ví dụ minh họa...', status: 'pending' },
        { step: 'save_db', message: 'Đang lưu trữ tài liệu vào cơ sở dữ liệu để tra cứu nhanh cho lần sau...', status: 'pending' }
      ]);
      setShowProgressModal(true);

      const res = await fetch(`${API_BASE_URL}/api/tutor/knowledge-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: selectedTopicId, stream: true })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi tra cứu kiến thức.');
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
          setSummaryContent(data.summary);
          setTimeout(() => setShowProgressModal(false), 800);
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
      console.error("Lỗi tải tóm tắt kiến thức:", error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Sinh đề thi tự động bằng Gemini AI
  const handleGenerateExam = async () => {
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
          title: `Đề thi Thích ứng AI - Chủ đề Cực trị (${new Date().toLocaleDateString('vi-VN')})`,
          topicId: 'cuc_tri_ham_so',
          difficulty: 7,
          numQuestions: 3,
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
          fetchDashboardData();
          setTimeout(() => setShowProgressModal(false), 800);
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
      console.error("Lỗi kết nối API sinh đề:", error);
      alert("Không thể kết nối đến máy chủ sinh đề thi.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading && !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '0.5rem' }}>
        <RefreshCw className="animate-spin" /> Đang tải thông tin học tập...
      </div>
    );
  }

  // Chuyển Knowledge Matrix Map thành array để render
  const matrixArray = user?.knowledge_matrix ? Object.entries(user.knowledge_matrix) : [];

  // Xác định màu sắc của thanh tiến độ theo thang điểm 10
  const getProgressClass = (score) => {
    if (score < 5.0) return 'poor';
    if (score < 8.0) return 'fair';
    return 'good';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Thanh tab điều hướng học sinh */}
      <div className="glass-panel student-nav-bar" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem' }}>
        <button 
          className={"nav-tab " + (activeTab === 'home' ? 'active' : '')}
          onClick={() => setActiveTab('home')}
        >
          <BookOpen size={16} />
          Luyện Đề & Năng Lực
        </button>
        <button 
          className={"nav-tab " + (activeTab === 'wiki' ? 'active' : '')}
          onClick={() => {
            setActiveTab('wiki');
            // Tự động load summary của chủ đề đầu tiên nếu chưa có nội dung
            if (!summaryContent && selectedTopicId) {
              setTimeout(() => {
                const triggerLoad = async () => {
                  setLoadingSummary(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/tutor/knowledge-summary`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ topicId: selectedTopicId })
                    });
                    const data = await res.json();
                    if (res.ok) setSummaryContent(data.summary);
                  } catch (e) { console.error(e); }
                  finally { setLoadingSummary(false); }
                };
                triggerLoad();
              }, 50);
            }
          }}
        >
          <Library size={16} />
          Thư Viện Kiến Thức AI
        </button>
      </div>

      {activeTab === 'home' && (
        <div className="dashboard-grid">
      {/* 1. Hồ sơ học sinh & Ma trận năng lực */}
      <div className="glass-panel profile-card">
        <div className="avatar-wrapper">
          {user?.full_name?.charAt(0) || 'U'}
        </div>
        <h3 className="profile-name">{user?.full_name || 'Chưa cập nhật'}</h3>
        <p className="profile-email">{user?.email}</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lớp học</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>Khối {user?.grade_level || 12}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Số đề thi đã làm</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{user?.total_tests_taken || 0}</div>
          </div>
        </div>

        {/* Ma trận kiến thức */}
        <div className="matrix-section">
          <h4 className="matrix-title">
            <Award size={18} style={{ color: 'var(--secondary)' }} />
            Ma Trận Kiến Thức (AI)
          </h4>
          {matrixArray.length === 0 ? (
            <p style={{ fontSize: '0.875rem' }}>Chưa có dữ liệu ma trận năng lực.</p>
          ) : (
            matrixArray.map(([topic, score]) => (
              <div key={topic} className="matrix-item">
                <div className="matrix-label">
                  <span className="topic-name">{topic.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: '700' }}>{score.toFixed(1)}/10.0</span>
                </div>
                <div className="progress-track">
                  <div 
                    className={`progress-fill ${getProgressClass(score)}`}
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Danh sách đề thi */}
      <div className="glass-panel exams-section">
        <div className="exams-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
            Đề Thi Khảo Sát
          </h3>
          <button 
            className="btn btn-primary"
            onClick={handleGenerateExam}
            disabled={generating}
          >
            <Sparkles size={16} />
            {generating ? 'AI đang sinh đề...' : 'Sinh đề thi AI'}
          </button>
        </div>

        <div className="exams-list">
          {exams.map((exam) => (
            <div key={exam._id} className="exam-card">
              <div>
                <h4 className="exam-title">{exam.title}</h4>
                <div className="exam-meta">
                  <div className="exam-meta-item">
                    <Clock size={12} />
                    {exam.time_limit_minutes} phút
                  </div>
                  <div className="exam-meta-item">
                    <BookOpen size={12} />
                    {exam.questions?.length || 0} câu hỏi
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onStartExam(user._id, exam._id)}
              >
                Bắt đầu làm bài
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Lịch sử làm bài thi */}
      <div className="glass-panel history-section">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
          Lịch sử thi & Giám sát Chống gian lận
        </h3>
        
        {history.length === 0 ? (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Bạn chưa thực hiện bài thi khảo sát nào.</p>
        ) : (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Đề thi</th>
                  <th>Ngày nộp</th>
                  <th>Thời gian</th>
                  <th>Điểm số</th>
                  <th>Cảnh báo Chuyển tab</th>
                  <th>Đánh giá gian lận</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const cheatCount = h.anti_cheat_logs?.tab_switch_count + h.anti_cheat_logs?.fullscreen_exit_count || 0;
                  const dateStr = new Date(h.createdAt).toLocaleDateString('vi-VN');
                  const timeSpent = Math.round((new Date(h.end_time) - new Date(h.start_time)) / 60000);
                  
                  return (
                    <tr key={h._id}>
                      <td style={{ fontWeight: '600' }}>{h.exam_id?.title || 'Đề thi đã sinh'}</td>
                      <td>{dateStr}</td>
                      <td>{timeSpent} phút</td>
                      <td style={{ fontWeight: '800', color: h.result_summary?.total_score >= 5 ? 'var(--success)' : 'var(--danger)' }}>
                        {h.result_summary?.total_score.toFixed(1)}
                      </td>
                      <td style={{ color: cheatCount > 0 ? 'var(--warning)' : 'inherit', fontWeight: cheatCount > 0 ? '700' : 'normal' }}>
                        {cheatCount > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertTriangle size={14} />
                            {cheatCount} lần vi phạm
                          </span>
                        ) : 'Không vi phạm'}
                      </td>
                      <td>
                        {cheatCount === 0 ? (
                          <span className="badge badge-success">An toàn</span>
                        ) : cheatCount <= 2 ? (
                          <span className="badge badge-warning">Nghi ngờ</span>
                        ) : (
                          <span className="badge badge-danger">Cảnh báo cao</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      )}

      {/* TAB 2: THƯ VIỆN KIẾN THỨC AI */}
      {activeTab === 'wiki' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Library style={{ color: 'var(--primary)' }} />
              Học tập & Tổng hợp Kiến thức bằng AI
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Chọn một chủ đề toán học bạn muốn học. AI sẽ biên soạn toàn bộ lý thuyết, công thức cốt lõi, phương pháp giải toán và các ví dụ minh họa sinh động dành riêng cho bạn.
            </p>

            <form onSubmit={handleLoadSummary} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  Chọn chủ đề toán học cần học
                </label>
                <select 
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                >
                  {topics.map((t) => (
                    <option key={t._id} value={t.topic_id}>
                      {t.name} ({t.chapter})
                    </option>
                  ))}
                  {topics.length === 0 && <option value="">Không có chủ đề nào khả dụng.</option>}
                </select>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loadingSummary || !selectedTopicId}
                style={{ padding: '0.6rem 1.5rem' }}
              >
                {loadingSummary ? (
                  "Đang biên soạn..."
                ) : (
                  "Tra cứu kiến thức"
                )}
              </button>
            </form>
          </div>

          {/* Vùng hiển thị nội dung tài liệu tổng hợp */}
          {(loadingSummary || summaryContent) && (
            <div className="glass-panel" style={{ padding: '2rem', background: 'rgba(20, 24, 33, 0.65)' }}>
              {loadingSummary ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
                    Trí tuệ nhân tạo (Gemini AI) đang đọc tài liệu và biên soạn nội dung học tập cho bạn...
                  </div>
                </div>
              ) : (
                <div className="wiki-content" style={{ color: '#e2e8f0', lineHeight: 1.7 }}>
                  <MathText text={summaryContent} />
                </div>
              )}
            </div>
          )}
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
