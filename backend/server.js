import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db.js';

// Import Models
import User from './models/User.js';
import Question from './models/Question.js';
import Topic from './models/Topic.js';
import Exam from './models/Exam.js';
import TestAttempt from './models/TestAttempt.js';

// Import Routes
import examRoutes from './routes/examRoutes.js';
import cheatRoutes from './routes/cheatRoutes.js';
import tutorRoutes from './routes/tutorRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Kết nối cơ sở dữ liệu MongoDB
connectDB();

// Middleware xử lý JSON & CORS
app.use(express.json());
app.use(cors());

// Register API Routes
app.use('/api/exams', examRoutes);
app.use('/api/test-attempts', cheatRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/admin', adminRoutes);

// API Root Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chào mừng bạn đến với Web Kiểm Tra Toán API!',
    available_endpoints: [
      'GET /api/users',
      'GET /api/questions',
      'GET /api/topics',
      'GET /api/exams',
      'GET /api/test-attempts'
    ]
  });
});

// GET /api/users - Lấy danh sách người dùng
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Đăng nhập / Đăng ký học sinh mới
app.post('/api/users', async (req, res) => {
  try {
    const { full_name, email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Thiếu email học sinh để đăng nhập' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.json(user);
    }

    // Tạo mới học sinh với ma trận năng lực ban đầu
    user = new User({
      full_name: full_name || email.split('@')[0],
      email: email,
      grade_level: 12,
      knowledge_matrix: {
        "dao_ham": 5.0,
        "tich_phan": 5.0,
        "hinh_khong_gian": 5.0,
        "luong_giac_11": 5.0
      },
      total_tests_taken: 0,
      status: 'active'
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/questions - Lấy ngân hàng câu hỏi thông minh
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find({});
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/topics - Lấy danh sách sơ đồ tri thức
app.get('/api/topics', async (req, res) => {
  try {
    const topics = await Topic.find({});
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/exams - Lấy danh sách đề thi (Được liên kết tự động tới các câu hỏi chi tiết)
app.get('/api/exams', async (req, res) => {
  try {
    const exams = await Exam.find({}).populate('questions');
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/test-attempts - Lịch sử làm bài thi
app.get('/api/test-attempts', async (req, res) => {
  try {
    const attempts = await TestAttempt.find({})
      .populate('user_id')
      .populate('exam_id')
      .populate('details.question_id');
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Khởi chạy server
app.listen(PORT, () => {
  console.log(`=== Máy chủ Express đang chạy tại http://localhost:${PORT} ===`);
});
