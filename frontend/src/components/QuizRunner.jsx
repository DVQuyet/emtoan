import React, { useState, useEffect, useRef } from 'react';
import { Shield, Timer, HelpCircle, CheckCircle, XCircle, ArrowRight, BookOpen, AlertOctagon, Brain, Sparkles } from 'lucide-react';
import MathText from './MathText';
import { API_BASE_URL } from '../config';

export default function QuizRunner({ attemptId, examId, userId, onFinish }) {
  const [exam, setExam] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState('');
  const [answeredMap, setAnsweredMap] = useState({}); // Lịch sử trả lời câu hỏi: { questionId: { selected, isCorrect, socraticHint } }
  const [timeLeft, setTimeLeft] = useState(0);
  const [cheats, setCheats] = useState({ tabSwitches: 0, fullscreenExits: 0, windowBlurs: 0, tabCloses: 0 });
  const isFullscreenSupported = !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullScreen ||
    document.documentElement.mozRequestFullScreen ||
    document.documentElement.msRequestFullscreen
  );

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const checkIsFullscreen = () => {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  };

  const [isFullscreen, setIsFullscreen] = useState(checkIsFullscreen() || !isFullscreenSupported || isMobile);
  const [hasStarted, setHasStarted] = useState(checkIsFullscreen() || !isFullscreenSupported || isMobile);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const questionRef = useRef(null);
  const isAlertingRef = useRef(false);
  
  // States cho tiến trình thời gian thực
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

  // 1. Tải đề thi thích ứng (thay thế câu làm sai bằng câu tương tự)
  useEffect(() => {
    const fetchExam = async () => {
      try {
        setProgressTitle("Đang thiết lập phòng thi thích ứng bằng AI...");
        setProgressSteps([
          { step: 'init', message: 'Bắt đầu kết nối phòng thi thích ứng...', status: 'pending' },
          { step: 'fetch_prev', message: 'Đang tải lịch sử làm bài trước đó...', status: 'pending' },
          { step: 'clone_start', message: 'Đang chuẩn bị các câu hỏi tương đương học sinh làm sai...', status: 'pending' }
        ]);
        setShowProgressModal(true);

        const url = `${API_BASE_URL}/api/exams/${examId}/adaptive?userId=${userId}&attemptId=${attemptId}&stream=true`;
        const res = await fetch(url);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Lỗi tải đề thích ứng.');
        }

        await readProgressStream(
          res,
          (msg, stepCode) => {
            setProgressSteps(prev => prev.map(s => {
              if (s.step === stepCode || (stepCode.startsWith('clone_') && s.step === 'clone_start')) {
                return { ...s, status: 'loading', message: msg };
              }
              const currentIdx = prev.findIndex(item => item.step === stepCode);
              let mappedIdx = currentIdx;
              if (stepCode.startsWith('clone_')) mappedIdx = prev.findIndex(item => item.step === 'clone_start');

              const thisIdx = prev.findIndex(item => item.step === s.step);
              if (thisIdx < mappedIdx && s.status !== 'success') {
                return { ...s, status: 'success' };
              }
              return s;
            }));
          },
          (data) => {
            setProgressSteps(prev => prev.map(s => ({ ...s, status: 'success' })));
            setExam(data);
            setTimeLeft((data?.time_limit_minutes || 45) * 60);
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
        console.error("Lỗi khi tải đề thi thích ứng:", error);
        alert(`Không thể tải đề thích ứng: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [examId, userId, attemptId]);

  // Tự động kích hoạt toàn màn hình khi vào phòng thi
  useEffect(() => {
    const requestAutoFS = async () => {
      const docElm = document.documentElement;
      try {
        if (docElm.requestFullscreen) {
          await docElm.requestFullscreen();
          setIsFullscreen(true);
        } else if (docElm.webkitRequestFullScreen) {
          await docElm.webkitRequestFullScreen();
          setIsFullscreen(true);
        } else if (docElm.mozRequestFullScreen) {
          await docElm.mozRequestFullScreen();
          setIsFullscreen(true);
        } else if (docElm.msRequestFullscreen) {
          await docElm.msRequestFullscreen();
          setIsFullscreen(true);
        }
      } catch (e) {
        console.warn("Tự động bật toàn màn hình bị trình duyệt từ chối:", e.message);
        if (isMobile || !isFullscreenSupported) {
          setIsFullscreen(true);
        }
      }
    };
    
    const timer = setTimeout(() => {
      requestAutoFS();
    }, 200);
    return () => clearTimeout(timer);
  }, []);



  // 3. Quản lý đồng hồ đếm ngược
  useEffect(() => {
    if (submitted || timeLeft <= 0 || loading) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit(); // Hết giờ tự động nộp bài
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, submitted, loading]);

  // 4. Giám sát chống gian lận (Tab Switch, Fullscreen, Window Blur, Tab Close)
  useEffect(() => {
    if (submitted || loading || !isFullscreen || isConfirming || submitting) return;

    const logCheatEvent = async (eventType, details) => {
      try {
        await fetch(`${API_BASE_URL}/api/test-attempts/${attemptId}/cheat-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType, details }),
          keepalive: true
        });
      } catch (err) {
        console.error("Lỗi log gian lận:", err);
      }
    };

    // Bắt sự kiện chuyển Tab / Ẩn ứng dụng (Visibility API)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        if (isAlertingRef.current) return;
        setCheats(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
        await logCheatEvent('tab_switch', 'Học sinh chuyển đổi cửa sổ/tab trình duyệt');
        isAlertingRef.current = true;
        alert("CẢNH BÁO GIAN LẬN: Hệ thống phát hiện bạn đã thoát/chuyển đổi tab! Hành vi này đã bị ghi lại.");
        setTimeout(() => {
          isAlertingRef.current = false;
        }, 1000);
      }
    };

    // Bắt sự kiện thoát Fullscreen
    const handleFullscreenChange = async () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      // Bỏ qua kiểm tra hoặc ghi nhận nếu là mobile hoặc trình duyệt không hỗ trợ Fullscreen API
      if (!isFullscreenSupported || isMobile) {
        setIsFullscreen(true);
        return;
      }

      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && !submitted) {
        if (isAlertingRef.current) return;
        setCheats(prev => ({ ...prev, fullscreenExits: prev.fullscreenExits + 1 }));
        await logCheatEvent('fullscreen_exit', 'Học sinh thoát chế độ toàn màn hình');
        isAlertingRef.current = true;
        alert("CẢNH BÁO GIAN LẬN: Hệ thống phát hiện bạn đã thoát chế độ Toàn màn hình! Hành vi này đã bị ghi lại.");
        setTimeout(() => {
          isAlertingRef.current = false;
        }, 1000);
      }
    };

    // Bắt sự kiện chuyển màn hình hoặc mất tiêu điểm cửa sổ (Window Blur)
    const handleWindowBlur = async () => {
      if (document.visibilityState === 'hidden' || isAlertingRef.current) return;
      setCheats(prev => ({ ...prev, windowBlurs: prev.windowBlurs + 1 }));
      await logCheatEvent('window_blur', 'Học sinh chuyển đổi màn hình hoặc mất tiêu điểm cửa sổ thi');
      isAlertingRef.current = true;
      alert("CẢNH BÁO GIAN LẬN: Hệ thống phát hiện bạn đã chuyển màn hình hoặc thoát khỏi cửa sổ thi! Hành vi này đã bị ghi lại.");
      setTimeout(() => {
        isAlertingRef.current = false;
      }, 1000);
    };

    // Bắt sự kiện tắt tab / reload (BeforeUnload)
    const handleBeforeUnload = (e) => {
      if (isAlertingRef.current) return;
      setCheats(prev => ({ ...prev, tabCloses: prev.tabCloses + 1 }));
      logCheatEvent('tab_close', 'Học sinh cố gắng đóng màn hình, tắt tab hoặc tải lại trang');
      
      e.preventDefault();
      e.returnValue = 'Bạn có chắc chắn muốn rời khỏi phòng thi? Hành vi này sẽ bị ghi lại là vi phạm!';
      return e.returnValue;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attemptId, submitted, loading, isFullscreen, isConfirming, submitting]);

  // Yêu cầu chế độ Fullscreen từ người dùng
  const enterFullscreen = () => {
    const docElm = document.documentElement;
    try {
      if (docElm.requestFullscreen) {
        docElm.requestFullscreen().then(() => {
          setIsFullscreen(true);
          setHasStarted(true);
        }).catch((err) => {
          console.error("Yêu cầu toàn màn hình bị từ chối:", err);
          alert("Không thể tự động kích hoạt chế độ Toàn màn hình (chặn bởi trình duyệt hoặc chạy trong iframe). Vui lòng nhấn F11 hoặc phóng to trình duyệt để làm bài thi bảo mật.");
          setIsFullscreen(true);
          setHasStarted(true);
        });
      } else if (docElm.mozRequestFullScreen) {
        docElm.mozRequestFullScreen();
        setIsFullscreen(true);
        setHasStarted(true);
      } else if (docElm.webkitRequestFullScreen) {
        docElm.webkitRequestFullScreen();
        setIsFullscreen(true);
        setHasStarted(true);
      } else if (docElm.msRequestFullscreen) {
        docElm.msRequestFullscreen();
        setIsFullscreen(true);
        setHasStarted(true);
      } else {
        setIsFullscreen(true);
        setHasStarted(true);
      }
    } catch (err) {
      console.error("Lỗi khi phóng to toàn màn hình:", err);
      setIsFullscreen(true);
      setHasStarted(true);
    }
  };

  const handleJumpToQuestion = (idx) => {
    setCurrentIdx(idx);
    const targetQ = exam.questions[idx];
    setSelectedAns(answeredMap[targetQ._id]?.selected || '');
  };

  // 5. Gửi đáp án cho từng câu
  const handleSubmitAnswer = async () => {
    if (!selectedAns) return;
    const currentQuestion = exam.questions[currentIdx];

    try {
      const res = await fetch(`${API_BASE_URL}/api/exams/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId: currentQuestion._id,
          selectedAnswer: selectedAns,
          timeSpentSeconds: 30 // Giả lập thời gian làm 30s
        })
      });
      const data = await res.json();
      
      // Lưu lại câu trả lời và gợi ý socratic nếu sai
      setAnsweredMap(prev => ({
        ...prev,
        [currentQuestion._id]: {
          selected: selectedAns,
          isCorrect: data.isCorrect,
          socraticHint: data.socratic_hint
        }
      }));
    } catch (error) {
      console.error("Lỗi gửi câu trả lời:", error);
    }
  };

  // 6. Nộp bài hoàn tất
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      setProgressTitle("Đang nộp bài thi & chấm điểm bằng AI...");
      setProgressSteps([
        { step: 'init', message: 'Bắt đầu nộp bài thi và tổng hợp kết quả...', status: 'pending' },
        { step: 'grading', message: 'Đang chấm điểm bài làm và tính toán phân bổ năng lực...', status: 'pending' },
        { step: 'save_user', message: 'Đang cập nhật Ma trận kiến thức học lực...', status: 'pending' },
        { step: 'call_ai', message: 'Đang gửi kết quả cho AI phân tích điểm yếu học lực...', status: 'pending' }
      ]);
      setShowProgressModal(true);

      const res = await fetch(`${API_BASE_URL}/api/exams/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, stream: true })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi khi nộp bài.');
      }

      await readProgressStream(
        res,
        (msg, stepCode) => {
          setProgressSteps(prev => prev.map(s => {
            const isAiStep = stepCode === 'fetch_attempt' || stepCode === 'prepare_prompt' || stepCode === 'call_ai' || stepCode === 'parse_response';
            if (s.step === stepCode || (isAiStep && s.step === 'call_ai')) {
              return { ...s, status: 'loading', message: msg };
            }
            const currentIdx = prev.findIndex(item => item.step === stepCode);
            let mappedIdx = currentIdx;
            if (isAiStep) mappedIdx = prev.findIndex(item => item.step === 'call_ai');

            const thisIdx = prev.findIndex(item => item.step === s.step);
            if (thisIdx < mappedIdx && s.status !== 'success') {
              return { ...s, status: 'success' };
            }
            return s;
          }));
        },
        (data) => {
          setProgressSteps(prev => prev.map(s => ({ ...s, status: 'success' })));
          setResult(data);
          setSubmitted(true);
          setTimeout(() => setShowProgressModal(false), 800);
          
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
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
      console.error("Lỗi nộp bài:", error);
      alert("Nộp bài thi thất bại do lỗi kết nối.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      alert("Đã hết thời gian làm bài! Hệ thống tự động nộp bài thi.");
      handleFinalSubmit();
    }, 50);
  };

  const handleForceSubmitCheat = async () => {
    setSubmitting(true);
    setTimeout(async () => {
      alert("BÀI THI BỊ HỦY: Bạn đã vi phạm quy chế thi quá 3 lần (chuyển tab, thoát toàn màn hình hoặc mất tập trung). Bài thi của bạn đã bị tự động dừng và nhận điểm 0.");
      
      try {
        setProgressTitle("Đang hủy bài thi do vi phạm quy chế...");
        setProgressSteps([
          { step: 'init', message: 'Ghi nhận hành vi vi phạm quy chế thi...', status: 'pending' },
          { step: 'grading', message: 'Hủy kết quả làm bài và đặt điểm số về 0...', status: 'pending' },
        { step: 'save_user', message: 'Cập nhật điểm 0 vào học lực cá nhân...', status: 'pending' }
      ]);
      setShowProgressModal(true);

      const res = await fetch(`${API_BASE_URL}/api/exams/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, stream: true, isCheated: true })
      });

      if (!res.ok) {
        throw new Error('Không thể kết nối máy chủ để ghi nhận vi phạm.');
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
          setResult(data);
          setSubmitted(true);
          setTimeout(() => setShowProgressModal(false), 800);
          
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
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
      console.error("Lỗi khi gửi báo cáo gian lận:", error);
      // Fallback local state nếu mạng lỗi
      setResult({
        score: 0,
        correctAnswers: `0/${exam?.questions?.length || 0}`,
        ai_report: {
          ai_evaluation: "Bài làm bị HỦY và nhận điểm 0 do vi phạm quy chế thi trực tuyến (hơn 3 lần thoát màn hình hoặc chuyển tab).",
          socratic_tutoring: "Bạn đã vi phạm quy chế thi bảo mật. Vui lòng làm bài trung thực ở lần thi tiếp theo và không thoát chế độ toàn màn hình."
        }
      });
      setSubmitted(true);
      setShowProgressModal(false);
    } finally {
      setSubmitting(false);
    }
    }, 50);
  };

  // Theo dõi số lần vi phạm để tự động nộp bài (0 điểm) nếu vi phạm từ 3 lần trở lên
  useEffect(() => {
    const totalCheats = cheats.tabSwitches + cheats.fullscreenExits + cheats.windowBlurs + cheats.tabCloses;
    if (totalCheats >= 3 && !submitted && !loading && !submitting) {
      handleForceSubmitCheat();
    }
  }, [cheats, submitted, loading, submitting, handleForceSubmitCheat]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '0.5rem' }}>
        <Timer className="animate-spin" /> Đang thiết lập phòng thi...
      </div>
    );
  }

  // Chế độ yêu cầu toàn màn hình trước khi làm bài
  if (!isFullscreen && !submitted) {
    return (
      <div className="glass-panel quiz-container" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <Shield size={64} style={{ color: hasStarted ? 'var(--warning)' : 'var(--primary)', marginBottom: '1.5rem', filter: hasStarted ? 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))' : 'drop-shadow(0 0 15px var(--primary-glow))' }} />
        <h2 style={{ marginBottom: '1rem' }}>
          {hasStarted ? 'Phòng thi bị Tạm khóa' : 'Bảo mật Phòng thi Trực tuyến'}
        </h2>
        <p style={{ marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
          {hasStarted 
            ? 'Bạn đã thoát khỏi chế độ Toàn màn hình. Để tiếp tục làm bài thi bảo mật, vui lòng kích hoạt lại chế độ Toàn màn hình.' 
            : 'Đề thi này yêu cầu kích hoạt chế độ **Toàn màn hình** để bắt đầu. Các hành vi thoát màn hình hoặc chuyển tab sẽ bị ghi nhận trực tiếp vào báo cáo chống gian lận gửi tới giáo viên.'
          }
        </p>
        <button className="btn btn-primary" onClick={enterFullscreen}>
          {hasStarted ? 'Kích hoạt lại Toàn màn hình & Tiếp tục làm bài' : 'Kích hoạt Toàn màn hình & Bắt đầu làm bài'}
        </button>
      </div>
    );
  }

  // Kết quả sau khi nộp bài
  if (submitted && result) {
    return (
      <div className="glass-panel quiz-container score-card">
        <CheckCircle size={64} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Đã hoàn thành bài kiểm tra!</h2>
        <p style={{ marginBottom: '2rem' }}>Đề thi: {exam.title}</p>
        
        <div className="score-badge">
          {result.score.toFixed(1)}
        </div>
        
        <p style={{ color: '#ffffff', fontWeight: '700', marginBottom: '2rem' }}>
          Số câu đúng: <span style={{ color: 'var(--success)' }}>{result.correctAnswers}</span> câu
        </p>

        {/* Báo cáo năng lực từ AI */}
        {result.ai_report && (
          <div className="ai-report-box">
            <h4 className="ai-report-title">
              <Brain size={20} style={{ color: 'var(--secondary)' }} />
              Phân tích học lực từ AI (Gemini)
            </h4>
            
            <div className="ai-report-block">
              <h5>Phân tích điểm yếu & Lỗi tư duy</h5>
              <p><MathText text={result.ai_report.ai_evaluation} /></p>
            </div>

            <div className="ai-report-block" style={{ marginTop: '1.5rem' }}>
              <h5>Định hướng ôn luyện chi tiết</h5>
              <p><MathText text={result.ai_report.socratic_tutoring} /></p>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={onFinish}>
          Quay lại Bảng điều khiển
        </button>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentIdx];
  const answeredInfo = answeredMap[currentQuestion?._id];
  const hasAnswered = !!answeredInfo;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel quiz-container" ref={questionRef}>
      {/* Quiz Header */}
      <div className="quiz-header">
        <div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{exam.title}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Câu {currentIdx + 1} trên {exam.questions.length}
          </span>
        </div>
        <div className={`timer ${timeLeft < 60 ? 'warning' : ''}`}>
          <Timer size={18} />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Cảnh báo vi phạm gian lận trực tiếp */}
      {(cheats.tabSwitches > 0 || cheats.fullscreenExits > 0 || cheats.windowBlurs > 0 || cheats.tabCloses > 0) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
          <AlertOctagon size={16} />
          Phát hiện {cheats.tabSwitches + cheats.fullscreenExits + cheats.windowBlurs + cheats.tabCloses} hành vi bất thường (Chuyển tab: {cheats.tabSwitches}, Thoát toàn màn hình: {cheats.fullscreenExits}, Chuyển màn hình: {cheats.windowBlurs}, Rời trang/Tải lại: {cheats.tabCloses}).
        </div>
      )}

      {/* Bản đồ câu hỏi (Navigation Grid) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem', padding: '0.85rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>Bản đồ câu hỏi (Nhấn để chọn câu):</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {exam.questions.map((q, idx) => {
            const isCurrent = idx === currentIdx;
            const isAnswered = !!answeredMap[q._id];
            
            let btnStyle = {
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'all 0.2s ease',
            };
            
            if (isCurrent) {
              btnStyle.borderColor = 'var(--primary)';
              btnStyle.boxShadow = '0 0 8px rgba(79, 70, 229, 0.5)';
            }
            
            if (isAnswered) {
              const isCorrect = answeredMap[q._id].isCorrect;
              btnStyle.background = isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
              btnStyle.color = isCorrect ? 'var(--success)' : 'var(--danger)';
              btnStyle.borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';
            } else {
              btnStyle.background = 'rgba(255, 255, 255, 0.05)';
              btnStyle.color = '#ffffff';
              btnStyle.borderColor = isCurrent ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)';
            }
            
            return (
              <button
                key={q._id}
                style={btnStyle}
                onClick={() => handleJumpToQuestion(idx)}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Box */}
      <div className="quiz-question-box">
        <div className="question-text">
          <MathText text={currentQuestion?.content || ''} />
        </div>
        
        <div className="options-list">
          {currentQuestion && Object.entries(currentQuestion.options).map(([key, val]) => {
            const isSelected = selectedAns === key;
            const isCorrectAnswer = currentQuestion.correct_answer === key;
            
            let btnClass = '';
            if (isSelected) btnClass = 'selected';
            
            // Highlight đáp án nếu đã trả lời xong câu này
            let icon = null;
            if (hasAnswered) {
              if (isCorrectAnswer) {
                btnClass = 'selected'; // Highlight đáp án đúng
              }
              if (answeredInfo.selected === key) {
                icon = answeredInfo.isCorrect ? 
                  <CheckCircle size={18} style={{ color: 'var(--success)', marginLeft: 'auto' }} /> : 
                  <XCircle size={18} style={{ color: 'var(--danger)', marginLeft: 'auto' }} />;
              }
            }

            return (
              <button 
                key={key} 
                className={`option-button ${btnClass}`}
                onClick={() => !hasAnswered && setSelectedAns(key)}
                disabled={hasAnswered}
              >
                <span className="option-label">{key}</span>
                <span><MathText text={val} /></span>
                {icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pop-up Gợi ý Socratic khi trả lời sai */}
      {hasAnswered && !answeredInfo.isCorrect && answeredInfo.socraticHint && (
        <div className="hint-alert">
          <HelpCircle className="hint-icon" size={20} />
          <div className="hint-content">
            <h4>Gợi ý gia sư ảo Socratic</h4>
            <p><MathText text={answeredInfo.socraticHint} /></p>
          </div>
        </div>
      )}

      {/* Quiz Actions */}
      <div className="quiz-actions">
        <div>
          {hasAnswered && !answeredInfo.isCorrect && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
              <XCircle size={16} /> Sai rồi. Hãy đọc gợi ý ở trên nhé!
            </div>
          )}
          {hasAnswered && answeredInfo.isCorrect && (
            <div style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
              <CheckCircle size={16} /> Hoàn toàn chính xác!
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-outline"
            style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            onClick={() => {
              setIsConfirming(true);
              setTimeout(() => {
                if (window.confirm("Bạn có chắc chắn muốn kết thúc và nộp bài thi ngay bây giờ?")) {
                  handleFinalSubmit();
                } else {
                  setTimeout(() => {
                    setIsConfirming(false);
                  }, 100);
                }
              }, 50);
            }}
            disabled={submitting}
          >
            Kết thúc bài thi
          </button>

          {!hasAnswered ? (
            <button 
              className="btn btn-primary"
              onClick={handleSubmitAnswer}
              disabled={!selectedAns}
            >
              Ghi nhận đáp án
            </button>
          ) : (
            currentIdx + 1 < exam.questions.length ? (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setCurrentIdx(prev => prev + 1);
                  setSelectedAns('');
                }}
              >
                Câu tiếp theo <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                style={{ background: 'var(--success)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
                onClick={handleFinalSubmit}
                disabled={submitting}
              >
                {submitting ? 'Đang nộp bài...' : 'Nộp bài hoàn tất'}
              </button>
            )
          )}
        </div>
      </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
