import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, RefreshCw, HelpCircle } from 'lucide-react';
import MathText from './MathText';
import { API_BASE_URL } from '../config';

export default function TutorChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Chào em, mình là Gia sư Toán học Socratic đây! Em đang gặp khó khăn ở bài toán hay chủ đề kiến thức nào? Hãy kể cho mình nghe, mình sẽ cùng em gỡ rối từng bước nhé!'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Cuộn tin nhắn xuống dưới cùng khi có tin mới
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = { role: 'user', content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // Gửi toàn bộ lịch sử lên API để duy trì ngữ cảnh cuộc trò chuyện
      const res = await fetch(`${API_BASE_URL}/api/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Xin lỗi em, gia sư ảo đang bận một chút: ${data.error || 'Lỗi không xác định'}` 
        }]);
      }
    } catch (error) {
      console.error("Lỗi chat với gia sư ảo:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Có lỗi kết nối xảy ra. Em vui lòng kiểm tra lại đường truyền hoặc khởi động lại máy chủ backend nhé!' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Bạn có muốn xóa cuộc hội thoại này và bắt đầu lại không?")) {
      setMessages([
        {
          role: 'assistant',
          content: 'Chào em, mình là Gia sư Toán học Socratic đây! Em đang gặp khó khăn ở bài toán hay chủ đề kiến thức nào? Hãy kể cho mình nghe, mình sẽ cùng em gỡ rối từng bước nhé!'
        }
      ]);
    }
  };

  return (
    <div className="glass-panel chat-container">
      {/* Header Hộp thoại */}
      <div 
        style={{ 
          padding: '1rem 1.5rem', 
          borderBottom: '1px solid var(--panel-border)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.01)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div 
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '20px', 
              background: 'rgba(6, 182, 212, 0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: 'var(--secondary)'
            }}
          >
            <Bot size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>Gia Sư Toán Socratic</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600' }}>• Đang trực tuyến (Groq Llama 3)</span>
          </div>
        </div>
        <button 
          className="btn btn-outline" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          onClick={handleClearChat}
        >
          Xóa chat
        </button>
      </div>

      {/* Danh sách Tin nhắn */}
      <div className="chat-messages" ref={chatContainerRef}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={idx} 
              className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}
              style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', opacity: 0.6, alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                {isUser ? <User size={12} /> : <Bot size={12} />}
                {isUser ? 'Học sinh' : 'Gia sư ảo'}
              </div>
              <div><MathText text={msg.content} /></div>
            </div>
          );
        })}
        {loading && (
          <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw className="animate-spin" size={16} />
            Gia sư đang suy nghĩ câu hỏi...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Nhập Tin nhắn */}
      <form onSubmit={handleSendMessage} className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder="Nhập câu hỏi toán học của em tại đây (ví dụ: Tính tích phân từ 0 đến 1...)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
        />
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ padding: '0 1.25rem' }}
          disabled={!inputValue.trim() || loading}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
