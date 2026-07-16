import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import QuizRunner from './components/QuizRunner';
import TutorChat from './components/TutorChat';
import AdminDashboard from './components/AdminDashboard';
import { LayoutDashboard, MessageSquare, GraduationCap, UserCog, LogOut, User } from 'lucide-react';

function App() {
  // Đọc session từ localStorage khi khởi động
  const getInitialSession = () => {
    const saved = localStorage.getItem('user_session');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (Date.now() - session.lastActivity < 3600000) {
          session.lastActivity = Date.now();
          localStorage.setItem('user_session', JSON.stringify(session));
          return session;
        } else {
          localStorage.removeItem('user_session');
        }
      } catch (e) {
        localStorage.removeItem('user_session');
      }
    }
    return null;
  };

  const initialSession = getInitialSession();

  const [role, setRole] = useState(initialSession ? initialSession.role : null); // null | 'student' | 'admin'
  const [currentUser, setCurrentUser] = useState(initialSession ? initialSession.user : null); // user object for student
  const [activeTab, setActiveTab] = useState('dashboard'); // student sub-tabs: 'dashboard' | 'chat'
  const [inExam, setInExam] = useState(false);
  const [examConfig, setExamConfig] = useState({ userId: null, examId: null, attemptId: null });

  const lastActivityRef = useRef(Date.now());

  // Xử lý sự kiện đăng nhập thành công
  const handleLogin = (user, userRole) => {
    setCurrentUser(user);
    setRole(userRole);
    setActiveTab('dashboard');
    
    const session = { user, role: userRole, lastActivity: Date.now() };
    localStorage.setItem('user_session', JSON.stringify(session));
    lastActivityRef.current = Date.now();
  };

  // Đăng xuất khỏi hệ thống
  const handleLogout = () => {
    if (inExam) {
      if (!window.confirm("Bạn đang trong phòng thi! Đăng xuất sẽ hủy bài làm hiện tại. Bạn có chắc chắn muốn đăng xuất không?")) {
        return;
      }
    }
    localStorage.removeItem('user_session');
    setRole(null);
    setCurrentUser(null);
    setInExam(false);
    setExamConfig({ userId: null, examId: null, attemptId: null });
  };

  // Theo dõi thao tác người dùng (mousemove, keydown, click, scroll) để cập nhật thời gian hoạt động
  useEffect(() => {
    if (!role) return;

    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      
      const saved = localStorage.getItem('user_session');
      if (saved) {
        try {
          const session = JSON.parse(saved);
          if (now - session.lastActivity > 10000) {
            session.lastActivity = now;
            localStorage.setItem('user_session', JSON.stringify(session));
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const checkInterval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= 3600000) {
        console.log("Phiên đăng nhập hết hạn do không có tương tác sau 1 tiếng. Đăng xuất...");
        handleLogout();
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(checkInterval);
    };
  }, [role, inExam]);

  // Bắt đầu làm bài thi (Gọi API tạo attempt mới và tự động bật toàn màn hình)
  const handleStartExam = async (userId, examId) => {
    // Kích hoạt toàn màn hình ngay từ click gesture của người dùng để tránh bị chặn
    const docElm = document.documentElement;
    let enteredFS = false;
    try {
      if (docElm.requestFullscreen) {
        await docElm.requestFullscreen();
        enteredFS = true;
      } else if (docElm.webkitRequestFullScreen) {
        await docElm.webkitRequestFullScreen();
        enteredFS = true;
      } else if (docElm.mozRequestFullScreen) {
        await docElm.mozRequestFullScreen();
        enteredFS = true;
      } else if (docElm.msRequestFullscreen) {
        await docElm.msRequestFullscreen();
        enteredFS = true;
      }
    } catch (err) {
      console.warn("Không thể kích hoạt tự động toàn màn hình từ sự kiện click:", err);
    }

    try {
      const res = await fetch('http://localhost:3000/api/exams/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, examId })
      });
      const data = await res.ok ? await res.json() : null;
      
      if (data && data.attempt) {
        setExamConfig({
          userId,
          examId,
          attemptId: data.attempt._id
        });
        setInExam(true);
      } else {
        alert("Không thể khởi tạo phiên làm bài thi. Vui lòng kiểm tra lại kết nối.");
        if (enteredFS && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch (error) {
      console.error("Lỗi khi kết nối bắt đầu thi:", error);
      alert("Lỗi kết nối đến máy chủ.");
      if (enteredFS && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleFinishExam = () => {
    setInExam(false);
    setExamConfig({ userId: null, examId: null, attemptId: null });
    setActiveTab('dashboard'); // Quay lại màn hình dashboard chính
  };

  // 1. Nếu chưa đăng nhập: Hiển thị màn hình Login
  if (role === null) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="container">
      {/* 2. Nếu đang làm bài thi: Hiển thị duy nhất phòng thi để tăng tính tập trung & bảo mật */}
      {inExam ? (
        <QuizRunner
          userId={examConfig.userId}
          examId={examConfig.examId}
          attemptId={examConfig.attemptId}
          onFinish={handleFinishExam}
        />
      ) : (
        <>
          {/* 3. Thanh điều hướng Tab Bar */}
          <div className="glass-panel nav-bar">
            {/* Logo */}
            <div className="nav-logo">
              <GraduationCap size={24} style={{ strokeWidth: 2.5 }} />
              <span>Học Toán THPT AI</span>
            </div>

            {/* Điều hướng Tab (Chỉ hiển thị Tab của Học sinh nếu vai trò là student) */}
            {role === 'student' && (
              <div className="nav-tabs">
                <button 
                  className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  <LayoutDashboard size={16} />
                  Bảng điều khiển
                </button>
                
                <button 
                  className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  <MessageSquare size={16} />
                  Gia sư ảo Llama3
                </button>
              </div>
            )}

            {/* Hiển thị tiêu đề Quản trị nếu vai trò là admin */}
            {role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--secondary)' }}>
                <UserCog size={18} />
                BẢNG QUẢN TRỊ GIÁO VIÊN
              </div>
            )}
            
            {/* Thanh hiển thị User Profile & Nút Đăng xuất */}
            <div className="nav-user-profile" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '16px', 
                    background: role === 'admin' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(79, 70, 229, 0.2)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid var(--panel-border)',
                    fontWeight: '700',
                    color: '#ffffff'
                  }}
                >
                  {role === 'admin' ? 'AD' : currentUser?.full_name?.charAt(0)}
                </div>
                <span style={{ fontWeight: '600', color: '#ffffff' }}>
                  {role === 'admin' ? 'Admin/Giáo viên' : currentUser?.full_name}
                </span>
              </div>

              <button 
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', gap: '0.25rem' }}
                onClick={handleLogout}
              >
                <LogOut size={12} />
                Đăng xuất
              </button>
            </div>
          </div>

          {/* 4. Hiển thị Giao diện theo vai trò và Tab chọn */}
          {role === 'student' ? (
            activeTab === 'dashboard' ? (
              <Dashboard 
                userId={currentUser?._id}
                onStartExam={handleStartExam} 
                activeAttemptId={examConfig.attemptId}
              />
            ) : (
              <TutorChat />
            )
          ) : (
            <AdminDashboard />
          )}
        </>
      )}
    </div>
  );
}

export default App;
