import React, { useState } from 'react';
import { LogIn, GraduationCap, ShieldCheck, Mail, User, Info } from 'lucide-react';

export default function Login({ onLogin }) {
  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const query = emailInput.trim();
    if (!query) return;

    setLoading(true);

    // 1. Nếu nhập từ khóa Admin
    if (query === 'admin' || query.toLowerCase() === 'admin@gmail.com') {
      setTimeout(() => {
        onLogin(null, 'admin');
        setLoading(false);
      }, 500);
      return;
    }

    // 2. Nếu đăng nhập/đăng ký học sinh
    // Tạo email chuẩn hóa nếu nhập text thông thường không có @
    const email = query.includes('@') ? query : `${query.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
    const fullName = fullNameInput.trim() || query;

    try {
      const res = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email: email
        })
      });
      const userData = await res.json();
      
      if (res.ok) {
        onLogin(userData, 'student');
      } else {
        alert(`Đăng nhập lỗi: ${userData.error}`);
      }
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert("Không thể kết nối đến máy chủ backend để xác thực.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 100px)', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem 2rem', position: 'relative' }}>
        
        {/* Logo tiêu đề */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div 
            style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '30px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff',
              margin: '0 auto 1rem auto',
              boxShadow: '0 0 20px rgba(79, 70, 229, 0.4)'
            }}
          >
            <GraduationCap size={32} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.25rem' }}>ĐĂNG NHẬP HỆ THỐNG</h2>
          <p style={{ fontSize: '0.85rem' }}>Ôn thi Toán THPT Quốc gia tích hợp Trí tuệ Nhân tạo</p>
        </div>

        {/* Form nhập liệu */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600', color: '#ffffff' }}>
              Tài khoản
            </label>
            <div style={{ position: 'relative' }}>
              <User 
                size={16} 
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
              />
              <input 
                type="text"
                required
                className="chat-input"
                style={{ width: '100%', paddingLeft: '38px' }}
                placeholder="Nhập tài khoản..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Nhập thêm họ tên nếu tạo mới học sinh */}
          {emailInput.trim() && emailInput.trim() !== 'admin' && emailInput.trim().toLowerCase() !== 'admin@gmail.com' && (
            <div style={{ animation: 'slideIn 0.2s ease-out' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600', color: '#ffffff' }}>
                Họ và tên của bạn <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Không bắt buộc)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User 
                  size={16} 
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
                />
                <input 
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="Nhập họ và tên đầy đủ..."
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }}
            disabled={loading || !emailInput.trim()}
          >
            <LogIn size={18} />
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập vào hệ thống'}
          </button>
        </form>

      </div>
    </div>
  );
}
