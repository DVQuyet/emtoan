import express from 'express';
import TestAttempt from '../models/TestAttempt.js';

const router = express.Router();

// POST /api/test-attempts/:attemptId/cheat-log - Ghi nhận sự kiện nghi ngờ gian lận
router.post('/:attemptId/cheat-log', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { eventType, details } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'Thiếu loại sự kiện gian lận (eventType)' });
    }

    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Không tìm thấy phiên làm bài thi tương ứng' });
    }

    const timestamp = new Date().toLocaleTimeString('vi-VN');
    let message = '';

    if (eventType === 'tab_switch') {
      attempt.anti_cheat_logs.tab_switch_count += 1;
      message = `[${timestamp}] Chuyển tab lần thứ ${attempt.anti_cheat_logs.tab_switch_count}. ${details || ''}`;
      attempt.anti_cheat_logs.suspicious_flags.push(message);
    } else if (eventType === 'fullscreen_exit') {
      attempt.anti_cheat_logs.fullscreen_exit_count += 1;
      message = `[${timestamp}] Thoát toàn màn hình lần thứ ${attempt.anti_cheat_logs.fullscreen_exit_count}. ${details || ''}`;
      attempt.anti_cheat_logs.suspicious_flags.push(message);
    } else if (eventType === 'window_blur') {
      message = `[${timestamp}] Chuyển màn hình / Mất tiêu điểm: ${details || ''}`;
      attempt.anti_cheat_logs.suspicious_flags.push(message);
    } else if (eventType === 'tab_close') {
      message = `[${timestamp}] Cố gắng đóng/tải lại trang: ${details || ''}`;
      attempt.anti_cheat_logs.suspicious_flags.push(message);
    } else {
      message = `[${timestamp}] Cảnh báo hành vi khác: ${details || 'Không rõ thông tin'}`;
      attempt.anti_cheat_logs.suspicious_flags.push(message);
    }

    await attempt.save();

    res.json({
      message: 'Ghi nhận nhật ký chống gian lận thành công',
      anti_cheat_logs: attempt.anti_cheat_logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
