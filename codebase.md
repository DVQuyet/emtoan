# TỔNG HỢP TOÀN BỘ MÃ NGUỒN DỰ ÁN (CODEBASE SUMMARY)

Tài liệu này tổng hợp toàn bộ cây thư mục và mã nguồn chi tiết các tệp cốt lõi của dự án **Web Ôn Thi Toán THPT**.

---

## 1. Cấu trúc thư mục dự án
```text
webkiemtratoan/
├── README.md                  # Tài liệu hướng dẫn chung dự án
├── codebase.md                # Tài liệu tổng hợp mã nguồn (tệp này)
├── database/                  # Cấu hình & Dữ liệu Docker Database
│   ├── docker-compose.yml
│   └── init-db.js             # Dữ liệu nạp mẫu cho Docker MongoDB
├── backend/                   # Ứng dụng Backend Node.js
│   ├── .env                   # Biến môi trường kết nối & AI Key
│   ├── package.json
│   ├── db.js                  # Module kết nối MongoDB
│   ├── server.js              # Entrypoint server Express
│   ├── seed.js                # Kịch bản nạp dữ liệu mẫu bằng Node (hỗ trợ Atlas)
│   ├── models/                # 5 Mongoose Models chính
│   │   ├── User.js
│   │   ├── Question.js
│   │   ├── Topic.js
│   │   ├── Exam.js
│   │   └── TestAttempt.js
│   ├── routes/                # 3 API Routers nghiệp vụ
│   │   ├── examRoutes.js      # API Làm bài, tính điểm, sinh đề bằng Gemini, xóa đề
│   │   ├── cheatRoutes.js     # API Ghi nhật ký chống gian lận
│   │   └── tutorRoutes.js     # API Gia sư chat Socratic bằng Groq
│   └── services/              # Dịch vụ AI tích hợp
│       ├── aiService.js       # Phân tích học lực & sinh đề thích ứng (Gemini SDK)
│       └── tutorService.js    # Gia sư chat hướng dẫn Socratic (Groq SDK)
└── frontend/                  # Ứng dụng giao diện khách hàng (Vite + React)
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── App.jsx
    │   ├── index.css
    │   ├── main.jsx
    │   └── components/        # Các Page / Component giao diện chính
    │       ├── Login.jsx
    │       ├── Dashboard.jsx
    │       ├── QuizRunner.jsx
    │       ├── TutorChat.jsx
    │       └── AdminDashboard.jsx
    └── vite.config.js
```

---

## 2. Chi tiết mã nguồn - DATABASE

### 2.1. [database/docker-compose.yml](file:///d:/webkiemtratoan/database/docker-compose.yml)
```yaml
services:
  mongodb:
    image: mongo:latest
    container_name: webkiemtratoan-mongodb
    ports:
      - "27018:27017"
    environment:
      - MONGO_INITDB_DATABASE=webkiemtratoan
    volumes:
      - mongodb_data:/data/db
      - ./init-db.js:/docker-entrypoint-initdb.d/init-db.js:ro

volumes:
  mongodb_data:
```

### 2.2. [database/init-db.js](file:///d:/webkiemtratoan/database/init-db.js)
```javascript
db = db.getSiblingDB('webkiemtratoan');

// Xóa dữ liệu cũ nếu có
db.users.drop();
db.questions.drop();
db.topics.drop();
db.exams.drop();
db.test_attempts.drop();

// 1. Khởi tạo Topics (Sơ đồ tri thức)
db.topics.insertMany([
  {
    _id: ObjectId("60d5ec49c63d5830ec123456"),
    topic_id: "cuc_tri_ham_so",
    name: "Cực trị của hàm số",
    chapter: "Ứng dụng đạo hàm",
    grade: 12,
    prerequisites: ["tinh_dao_ham", "xet_dau_da_thuc"]
  },
  {
    _id: ObjectId("60d5ec49c63d5830ec123457"),
    topic_id: "tich_phan_co_ban",
    name: "Tích phân cơ bản",
    chapter: "Nguyên hàm và Tích phân",
    grade: 12,
    prerequisites: ["nguyen_ham_co_ban"]
  }
]);

// 2. Khởi tạo Questions (Ngân hàng câu hỏi thông minh)
db.questions.insertMany([
  {
    _id: ObjectId("60d5ec49c63d5830ec123458"),
    content: "Cho hàm số $y = x^3 - 3x + 2$. Điểm cực đại của đồ thị hàm số là?",
    options: {
      "A": "$(1,0)$",
      "B": "$(-1,4)$",
      "C": "$(-1,0)$",
      "D": "$(1,4)$"
    },
    correct_answer: "B",
    metadata: {
      topic: "dao_ham",
      sub_topic: "cuc_tri_ham_so",
      difficulty_score: 6,
      source: "THPT_QG_2023"
    },
    ai_analysis: {
      distractor_analysis: {
        "A": "Học sinh tính nhầm sang điểm cực tiểu.",
        "C": "Học sinh nhầm dấu khi giải phương trình y'=0.",
        "D": "Học sinh tính nhầm giá trị tung độ y."
      },
      socratic_hint: "Bạn hãy tính đạo hàm y' trước, sau đó tìm nghiệm y'=0 và lập bảng biến thiên nhé.",
      solution_steps: "Bước 1: y' = 3x^2 - 3. Bước 2: y'=0 => x = 1 hoặc x = -1..."
    },
    embedding: [0.124, -0.532, 0.992]
  },
  {
    _id: ObjectId("60d5ec49c63d5830ec123459"),
    content: "Tính tích phân $I = \\int_{0}^{1} x dx$.",
    options: {
      "A": "$1$",
      "B": "$\\frac{1}{2}$",
      "C": "$2$",
      "D": "$0$"
    },
    correct_answer: "B",
    metadata: {
      topic: "tich_phan",
      sub_topic: "tich_phan_co_ban",
      difficulty_score: 4,
      source: "THPT_QG_2024"
    },
    ai_analysis: {
      distractor_analysis: {
        "A": "Học sinh tính nhầm đạo hàm thay vì nguyên hàm.",
        "C": "Học sinh tính nguyên hàm là x^2 thay vì x^2/2.",
        "D": "Học sinh thế sai giá trị cận."
      },
      socratic_hint: "Tìm nguyên hàm F(x) của x trước, sau đó tính F(1) - F(0).",
      solution_steps: "Bước 1: Nguyên hàm của x là x^2/2. Bước 2: Thay cận từ 0 đến 1: (1^2/2) - (0^2/2) = 1/2."
    },
    embedding: [0.045, -0.211, 0.887]
  }
]);

// 3. Khởi tạo Users (Hồ sơ & Ma trận kiến thức)
db.users.insertMany([
  {
    _id: ObjectId("60d5ec49c63d5830ec123450"),
    full_name: "Nguyễn Văn A",
    email: "vana@gmail.com",
    grade_level: 12,
    join_date: new Date("2026-07-06T00:00:00Z"),
    knowledge_matrix: {
      "dao_ham": 8.5,
      "tich_phan": 4.0,
      "hinh_khong_gian": 6.0,
      "luong_giac_11": 5.5
    },
    total_tests_taken: 15,
    status: "active"
  }
]);

// 4. Khởi tạo Exams (Khung đề thi)
db.exams.insertMany([
  {
    _id: ObjectId("60d5ec49c63d5830ec12345a"),
    title: "Đề Khảo sát chất lượng Toán 12 - Lần 1",
    exam_type: "diagnostic",
    time_limit_minutes: 90,
    questions: [
      ObjectId("60d5ec49c63d5830ec123458"),
      ObjectId("60d5ec49c63d5830ec123459")
    ],
    security_settings: {
      require_fullscreen: true,
      max_tab_switches: 3
    }
  }
]);

// 5. Khởi tạo TestAttempts (Lịch sử làm bài)
db.test_attempts.insertMany([
  {
    _id: ObjectId("60d5ec49c63d5830ec12345b"),
    user_id: ObjectId("60d5ec49c63d5830ec123450"),
    exam_id: ObjectId("60d5ec49c63d5830ec12345a"),
    start_time: new Date("2026-07-06T19:00:00Z"),
    end_time: new Date("2026-07-06T20:30:00Z"),
    details: [
      {
        question_id: ObjectId("60d5ec49c63d5830ec123458"),
        selected_answer: "B",
        is_correct: true,
        time_spent_seconds: 45
      },
      {
        question_id: ObjectId("60d5ec49c63d5830ec123459"),
        selected_answer: "C",
        is_correct: false,
        time_spent_seconds: 120
      }
    ],
    anti_cheat_logs: {
      tab_switch_count: 1,
      fullscreen_exit_count: 0,
      suspicious_flags: ["Thời gian làm câu 1 hơi nhanh"]
    },
    result_summary: {
      total_score: 5.0,
      topic_performance: {
        "dao_ham": { "correct": 1, "total": 1 },
        "tich_phan": { "correct": 0, "total": 1 }
      }
    }
  }
]);

print("=== HOÀN THÀNH KHỞI TẠO DỮ LIỆU MẪU WEB KIỂM TRA TOÁN ===");
```

---

## 3. Chi tiết mã nguồn - BACKEND

### 3.1. [backend/.env](file:///d:/webkiemtratoan/backend/.env)
```env
PORT=3000
MONGO_URI=mongodb+srv://dinhvietquyet984_db_user:vvhgZ6tBIQRzvhrd@toanthpt.sotgiml.mongodb.net/
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_key_here
```

### 3.2. [backend/package.json](file:///d:/webkiemtratoan/backend/package.json)
```json
{
  "name": "webkiemtratoan-backend",
  "version": "1.0.0",
  "description": "Backend kết nối MongoDB cho Web Kiểm tra Toán",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "groq-sdk": "^0.5.0",
    "mongoose": "^8.4.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.2"
  }
}
```

### 3.3. [backend/db.js](file:///d:/webkiemtratoan/backend/db.js)
```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/webkiemtratoan';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`=== Kết nối thành công tới MongoDB Atlas / Local: ${conn.connection.host} ===`);
  } catch (error) {
    console.error(`Lỗi kết nối tới MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
```

### 3.4. [backend/server.js](file:///d:/webkiemtratoan/backend/server.js)
```javascript
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

// API Root Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chào mừng bạn đến với Web Kiểm Tra Toán API!',
    available_endpoints: [
      'GET /api/users',
      'POST /api/users',
      'GET /api/questions',
      'GET /api/topics',
      'GET /api/exams',
      'GET /api/test-attempts',
      'POST /api/tutor/chat',
      'POST /api/exams/generate'
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
```

---

## 4. Chi tiết mã nguồn - MODELS

### 4.1. [backend/models/User.js](file:///d:/webkiemtratoan/backend/models/User.js)
```javascript
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  grade_level: {
    type: Number,
    required: true
  },
  join_date: {
    type: Date,
    default: Date.now
  },
  knowledge_matrix: {
    type: Map,
    of: Number,
    default: {}
  },
  total_tests_taken: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'users'
});

const User = mongoose.model('User', UserSchema);
export default User;
```

### 4.2. [backend/models/Question.js](file:///d:/webkiemtratoan/backend/models/Question.js)
```javascript
import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  options: {
    type: Map,
    of: String,
    required: true
  },
  correct_answer: {
    type: String,
    required: true
  },
  metadata: {
    topic: { type: String, required: true },
    sub_topic: { type: String },
    difficulty_score: { type: Number },
    source: { type: String }
  },
  ai_analysis: {
    distractor_analysis: {
      type: Map,
      of: String
    },
    socratic_hint: { type: String },
    solution_steps: { type: String }
  },
  embedding: {
    type: [Number],
    default: []
  }
}, {
  timestamps: true,
  collection: 'questions'
});

const Question = mongoose.model('Question', QuestionSchema);
export default Question;
```

### 4.3. [backend/models/Topic.js](file:///d:/webkiemtratoan/backend/models/Topic.js)
```javascript
import mongoose from 'mongoose';

const TopicSchema = new mongoose.Schema({
  topic_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  chapter: {
    type: String,
    required: true
  },
  grade: {
    type: Number,
    required: true
  },
  prerequisites: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
  collection: 'topics'
});

const Topic = mongoose.model('Topic', TopicSchema);
export default Topic;
```

### 4.4. [backend/models/Exam.js](file:///d:/webkiemtratoan/backend/models/Exam.js)
```javascript
import mongoose from 'mongoose';

const ExamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  exam_type: {
    type: String,
    enum: ['diagnostic', 'adaptive', 'mock_exam'],
    default: 'diagnostic'
  },
  time_limit_minutes: {
    type: Number,
    required: true
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  security_settings: {
    require_fullscreen: { type: Boolean, default: false },
    max_tab_switches: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'exams'
});

const Exam = mongoose.model('Exam', ExamSchema);
export default Exam;
```

### 4.5. [backend/models/TestAttempt.js](file:///d:/webkiemtratoan/backend/models/TestAttempt.js)
```javascript
import mongoose from 'mongoose';

const DetailSchema = new mongoose.Schema({
  question_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  selected_answer: {
    type: String,
    required: true
  },
  is_correct: {
    type: Boolean,
    required: true
  },
  time_spent_seconds: {
    type: Number,
    required: true
  }
}, { _id: false });

const TestAttemptSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
  },
  details: [DetailSchema],
  anti_cheat_logs: {
    tab_switch_count: { type: Number, default: 0 },
    fullscreen_exit_count: { type: Number, default: 0 },
    suspicious_flags: [{ type: String }]
  },
  result_summary: {
    total_score: { type: Number, required: true },
    topic_performance: {
      type: Map,
      of: {
        correct: Number,
        total: Number
      }
    }
  }
}, {
  timestamps: true,
  collection: 'test_attempts'
});

const TestAttempt = mongoose.model('TestAttempt', TestAttemptSchema);
export default TestAttempt;
```

---

## 5. Chi tiết mã nguồn - API ROUTES

### 5.1. [backend/routes/examRoutes.js](file:///d:/webkiemtratoan/backend/routes/examRoutes.js)
```javascript
import express from 'express';
import TestAttempt from '../models/TestAttempt.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import { analyzeAttempt, generateExamWithGemini } from '../services/aiService.js';

const router = express.Router();

// POST /api/exams/start - Khởi tạo phiên làm bài thi mới
router.post('/start', async (req, res) => {
  try {
    const { userId, examId } = req.body;

    if (!userId || !examId) {
      return res.status(400).json({ error: 'Thiếu thông tin userId hoặc examId' });
    }

    const user = await User.findById(userId);
    const exam = await Exam.findById(examId);

    if (!user || !exam) {
      return res.status(404).json({ error: 'Không tìm thấy học sinh hoặc đề thi tương ứng' });
    }

    const attempt = new TestAttempt({
      user_id: userId,
      exam_id: examId,
      start_time: new Date(),
      end_time: new Date(),
      details: [],
      anti_cheat_logs: {
        tab_switch_count: 0,
        fullscreen_exit_count: 0,
        suspicious_flags: []
      },
      result_summary: {
        total_score: 0,
        topic_performance: {}
      }
    });

    await attempt.save();
    res.status(201).json({
      message: 'Khởi tạo phiên làm bài thi thành công',
      attempt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/exams/submit-answer - Gửi đáp án từng câu hỏi
router.post('/submit-answer', async (req, res) => {
  try {
    const { attemptId, questionId, selectedAnswer, timeSpentSeconds } = req.body;

    if (!attemptId || !questionId || !selectedAnswer) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc' });
    }

    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Không tìm thấy phiên làm bài thi' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });
    }

    const isCorrect = (question.correct_answer === selectedAnswer);

    const existingAnswerIndex = attempt.details.findIndex(
      d => d.question_id.toString() === questionId
    );

    const answerDetail = {
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      time_spent_seconds: timeSpentSeconds || 0
    };

    if (existingAnswerIndex > -1) {
      attempt.details[existingAnswerIndex] = answerDetail;
    } else {
      attempt.details.push(answerDetail);
    }

    await attempt.save();

    res.json({
      message: 'Ghi nhận đáp án thành công',
      isCorrect,
      socratic_hint: isCorrect ? null : question.ai_analysis.socratic_hint
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/exams/submit - Hoàn tất và nộp bài thi
router.post('/submit', async (req, res) => {
  try {
    const { attemptId } = req.body;

    if (!attemptId) {
      return res.status(400).json({ error: 'Thiếu attemptId' });
    }

    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Không tìm thấy phiên làm bài thi' });
    }

    const exam = await Exam.findById(attempt.exam_id).populate('questions');
    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy cấu trúc đề thi tương ứng' });
    }

    attempt.end_time = new Date();

    const totalQuestions = exam.questions.length;
    let correctCount = 0;
    const topicPerformance = new Map();

    for (const q of exam.questions) {
      const topic = q.metadata.topic || 'chung';
      
      const answer = attempt.details.find(d => d.question_id.toString() === q._id.toString());
      const isCorrect = answer ? answer.is_correct : false;

      if (isCorrect) {
        correctCount++;
      }

      if (!topicPerformance.has(topic)) {
        topicPerformance.set(topic, { correct: 0, total: 0 });
      }
      const stats = topicPerformance.get(topic);
      stats.total += 1;
      if (isCorrect) {
        stats.correct += 1;
      }
    }

    const finalScore = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

    attempt.result_summary = {
      total_score: finalScore,
      topic_performance: Object.fromEntries(topicPerformance)
    };

    const user = await User.findById(attempt.user_id);
    if (user) {
      user.total_tests_taken += 1;
      
      topicPerformance.forEach((stats, topic) => {
        const currentRating = user.knowledge_matrix.get(topic) || 5.0;
        const successRate = stats.correct / stats.total;
        
        const examRating = successRate * 10;
        const newRating = parseFloat((currentRating * 0.8 + examRating * 0.2).toFixed(2));
        
        user.knowledge_matrix.set(topic, newRating);
      });

      await user.save();
    }

    await attempt.save();

    // Gọi AI phân tích kết quả bài làm
    const aiReport = await analyzeAttempt(attemptId);

    res.json({
      message: 'Nộp bài thi thành công!',
      score: finalScore,
      correctAnswers: `${correctCount}/${totalQuestions}`,
      result_summary: attempt.result_summary,
      knowledge_matrix_updated: user ? user.knowledge_matrix : null,
      ai_report: aiReport
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/exams/generate - Sinh đề thi tự động bằng Gemini AI
router.post('/generate', async (req, res) => {
  try {
    const { title, topicId, difficulty, numQuestions } = req.body;

    if (!topicId) {
      return res.status(400).json({ error: 'Thiếu thông tin chủ đề (topicId) để sinh đề thi' });
    }

    const targetDifficulty = difficulty ? parseInt(difficulty) : 5;
    const count = numQuestions ? parseInt(numQuestions) : 5;

    console.log(`Đang sinh đề thi "${title || 'Không tên'}" chủ đề: ${topicId}, số câu: ${count}, độ khó: ${targetDifficulty}`);
    const exam = await generateExamWithGemini(title, topicId, targetDifficulty, count);

    res.status(201).json({
      message: 'Sinh đề thi bằng Gemini thành công và đã lưu vào cơ sở dữ liệu!',
      exam
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/exams/:id - Xóa đề thi
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findByIdAndDelete(id);
    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy đề thi để xóa' });
    }
    res.json({ message: 'Xóa đề thi thành công!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 5.2. [backend/routes/cheatRoutes.js](file:///d:/webkiemtratoan/backend/routes/cheatRoutes.js)
```javascript
import express from 'express';
import TestAttempt from '../models/TestAttempt.js';

const router = express.Router();

// POST /api/test-attempts/:attemptId/cheat-log - Ghi nhận sự kiện gian lận
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
```

### 5.3. [backend/routes/tutorRoutes.js](file:///d:/webkiemtratoan/backend/routes/tutorRoutes.js)
```javascript
import express from 'express';
import { chatWithSocraticTutor } from '../services/tutorService.js';

const router = express.Router();

// POST /api/tutor/chat - Trò chuyện hỏi đáp toán học với Gia sư Socratic
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Thiếu hoặc sai định dạng lịch sử hội thoại (messages)' });
    }

    console.log(`Đang xử lý yêu cầu chat gia sư ảo (Groq/Llama3). Số lượng tin nhắn: ${messages.length}`);
    const responseText = await chatWithSocraticTutor(messages);

    res.json({
      message: 'Gia sư ảo phản hồi thành công!',
      response: responseText
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## 6. Chi tiết mã nguồn - SERVICES

### 6.1. [backend/services/aiService.js](file:///d:/webkiemtratoan/backend/services/aiService.js)
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import TestAttempt from '../models/TestAttempt.js';
import User from '../models/User.js';
import Question from '../models/Question.js';
import Exam from '../models/Exam.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let aiModel = null;

if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  try {
    const ai = new GoogleGenerativeAI(apiKey);
    aiModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log("=== Khởi tạo thành công dịch vụ AI Gemini ===");
  } catch (error) {
    console.error("Lỗi khi cấu hình Gemini SDK:", error.message);
  }
} else {
  console.log("=== Cảnh báo: Chưa có GEMINI_API_KEY thực tế. Đang chạy AI ở chế độ mô phỏng (Mock mode) ===");
}

export const generateSocraticHint = async (questionContent, wrongAnswer, correctAnswer) => {
  if (!aiModel) {
    return `Gợi ý gợi mở (Socratic): Hãy xem lại bước tính đạo hàm y' hoặc các phương thức rút gọn cơ bản liên quan đến ${correctAnswer} nhé.`;
  }
  try {
    const prompt = `Bạn là một gia sư toán học Socratic thân thiện. Học sinh đang làm câu hỏi sau:
"${questionContent}"
Đáp án đúng là: ${correctAnswer}
Nhưng học sinh chọn đáp án sai là: ${wrongAnswer}

Hãy tạo ra một gợi ý ngắn gọn (không quá 2-3 câu), định hướng tư duy (Socratic hint) giúp học sinh tự nhận ra lỗi sai hoặc tìm ra hướng đi đúng. KHÔNG được cho biết trực tiếp đáp án đúng hoặc đưa ra lời giải chi tiết trực diện. Gợi ý bằng tiếng Việt.`;
    
    const result = await aiModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Lỗi khi sinh gợi ý Socratic:", error.message);
    return "Hãy đọc kỹ đề bài và tính toán cẩn thận từng bước giải.";
  }
};

export const analyzeAttempt = async (attemptId) => {
  try {
    const attempt = await TestAttempt.findById(attemptId)
      .populate('user_id')
      .populate('exam_id')
      .populate('details.question_id');
      
    if (!attempt) return null;

    if (!aiModel) {
      console.log("Mô phỏng AI phân tích kết quả bài làm cho attempt:", attemptId);
      return {
        ai_evaluation: "Đánh giá (Mô phỏng): Bạn đang có kết quả tốt ở chủ đề đạo hàm cực trị, tuy nhiên phần tính tích phân cơ bản còn yếu (tỉ lệ đúng thấp). Lỗi phổ biến là nhầm lẫn các công thức nguyên hàm.",
        socratic_tutoring: "Lời khuyên: Hãy xem lại bảng nguyên hàm cơ bản và thực hành 5 bài tập mức độ dễ của phần Tích phân để lấy lại căn bản."
      };
    }

    const wrongAnswers = attempt.details.filter(d => !d.is_correct);
    if (wrongAnswers.length === 0) {
      return {
        ai_evaluation: "Đánh giá xuất sắc! Bạn đã trả lời đúng hoàn toàn tất cả câu hỏi trong bài làm thi thử này.",
        socratic_tutoring: "Định hướng: Hãy bắt đầu thử sức với các bài thi thích ứng mức độ khó cao hơn (Ví dụ: đề thích ứng có difficulty_score từ 7 trở lên) để nâng cao giới hạn bản thân."
      };
    }

    const wrongAnswersSummary = wrongAnswers.map((wa, idx) => {
      const q = wa.question_id;
      let distractorText = 'Không có phân tích từ hệ thống.';
      if (q.ai_analysis && q.ai_analysis.distractor_analysis) {
        distractorText = q.ai_analysis.distractor_analysis.get(wa.selected_answer) || distractorText;
      }
      
      return `Câu sai ${idx + 1}:
- Nội dung câu hỏi: ${q.content}
- Đáp án đúng: ${q.correct_answer}
- Học sinh đã chọn: ${wa.selected_answer}
- Phân tích nguyên nhân chọn sai: ${distractorText}`;
    }).join('\n\n');

    const prompt = `Bạn là một Chuyên gia phân tích năng lực toán học AI cho học sinh THPT.
Hãy phân tích kết quả bài làm toán của học sinh sau:
- Họ và tên học sinh: ${attempt.user_id.full_name}
- Điểm số bài kiểm tra: ${attempt.result_summary.total_score} / 10

Dưới đây là chi tiết các câu học sinh làm sai:
${wrongAnswersSummary}

Hãy viết một báo cáo đánh giá ngắn gọn bằng tiếng Việt bao gồm 2 phần chính:
1. "Đánh giá điểm yếu kiến thức & Tư duy": Chỉ ra chính xác học sinh đang yếu ở phần nào (chương, chủ đề nào) và loại sai lầm tư duy học sinh hay mắc phải.
2. "Định hướng ôn tập Socratic": Đưa ra các gợi ý ôn luyện cụ thể, khuyến khích học tập tự thân mà không gây nản chí.`;

    const result = await aiModel.generateContent(prompt);
    const responseText = result.response.text().trim();

    const parts = responseText.split(/2\.\s*\"?Định hướng/i);
    const evaluation = parts[0].replace(/1\.\s*\"?Đánh giá[^\n]*/i, '').trim();
    const tutoring = parts[1] ? parts[1].trim() : "Hãy tiếp tục xem lại lý thuyết cốt lõi và thực hành thêm các bài tập tự luyện.";

    return {
      ai_evaluation: evaluation,
      socratic_tutoring: tutoring
    };
  } catch (error) {
    console.error("Lỗi khi gọi Gemini phân tích bài thi:", error.message);
    return {
      ai_evaluation: "Báo cáo phân tích bài thi tạm thời chưa thể tạo do lỗi kết nối dịch vụ AI.",
      socratic_tutoring: "Hãy chủ động xem lại lời giải của từng câu hỏi để khắc phục lỗi sai."
    };
  }
};

export const generateExamWithGemini = async (title, topicId, difficulty, numQuestions) => {
  try {
    let generatedQuestions = [];

    if (!aiModel) {
      console.log("Mô phỏng Gemini sinh đề thi cho chủ đề:", topicId);
      generatedQuestions = [
        {
          content: `[Mô phỏng] Cho hàm số thuộc chủ đề ${topicId}. Tìm giá trị cực tiểu của hàm số.`,
          options: { "A": "1", "B": "2", "C": "3", "D": "4" },
          correct_answer: "A",
          ai_analysis: {
            distractor_analysis: {
              "B": "Học sinh nhầm lẫn với giá trị cực đại.",
              "C": "Học sinh nhầm lẫn khi lập bảng biến thiên.",
              "D": "Học sinh tính sai đạo hàm y'."
            },
            socratic_hint: "Bạn hãy tính đạo hàm y' và tìm nghiệm của y'=0.",
            solution_steps: "Bước 1: Tính y'. Bước 2: Cho y'=0 tìm nghiệm. Bước 3: Lập bảng xét dấu."
          }
        },
        {
          content: `[Mô phỏng] Tính tích phân cơ bản liên quan đến chủ đề ${topicId} tại mức độ khó ${difficulty}.`,
          options: { "A": "0", "B": "1/2", "C": "1", "D": "2" },
          correct_answer: "B",
          ai_analysis: {
            distractor_analysis: {
              "A": "Học sinh thế sai giá trị cận.",
              "C": "Học sinh nhầm lẫn nguyên hàm của x thành x^2.",
              "D": "Học sinh tính sai giá trị hằng số."
            },
            socratic_hint: "Hãy thực hiện tính nguyên hàm của biểu thức trước.",
            solution_steps: "Áp dụng định nghĩa nguyên hàm cơ bản để tính toán."
          }
        }
      ];
    } else {
      const prompt = `Bạn là chuyên gia ra đề thi Toán THPT Quốc gia.
Hãy sinh một danh sách gồm ${numQuestions} câu hỏi trắc nghiệm Toán học lớp 12 thuộc chủ đề "${topicId}" với độ khó mục tiêu là ${difficulty}/10.
Các câu hỏi và đáp án phải sử dụng định dạng toán học LaTeX (ví dụ: $y = x^2$ hoặc $\\int x dx$).

Kết quả trả về BẮT BUỘC phải là một mảng JSON thuần túy, không có ký tự bao quanh như \`\`\`json hay bất kỳ dòng giải thích nào khác ngoài chuỗi JSON. Cấu trúc mỗi phần tử câu hỏi trong mảng như sau:
[
  {
    "content": "Nội dung câu hỏi...",
    "options": {
      "A": "Lựa chọn A...",
      "B": "Lựa chọn B...",
      "C": "Lựa chọn C...",
      "D": "Lựa chọn D..."
    },
    "correct_answer": "A hoặc B hoặc C hoặc D",
    "ai_analysis": {
      "distractor_analysis": {
        "chữ_cái_đáp_án_sai_1": "Lý giải tại sau học sinh chọn đáp án sai này...",
        "chữ_cái_đáp_án_sai_2": "Lý giải tại sau học sinh chọn đáp án sai này...",
        "chữ_cái_đáp_án_sai_3": "Lý giải tại sau học sinh chọn đáp án sai này..."
      },
      "socratic_hint": "Gợi ý định hướng tư duy Socratic ngắn gọn...",
      "solution_steps": "Lời giải chi tiết từng bước..."
    }
  }
]`;

      const result = await aiModel.generateContent(prompt);
      const rawText = result.response.text().trim();
      
      const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      generatedQuestions = JSON.parse(cleanJsonText);
    }

    const questionDocs = generatedQuestions.map(q => ({
      content: q.content,
      options: q.options,
      correct_answer: q.correct_answer,
      metadata: {
        topic: topicId,
        sub_topic: topicId + '_tu_dong',
        difficulty_score: difficulty,
        source: 'AI_Gemini'
      },
      ai_analysis: q.ai_analysis,
      embedding: [0.0, 0.0, 0.0]
    }));

    const savedQuestions = await Question.insertMany(questionDocs);
    const questionIds = savedQuestions.map(q => q._id);

    const exam = new Exam({
      title: title || `Đề ôn tập chủ đề ${topicId} - Sinh tự động bởi AI`,
      exam_type: 'adaptive',
      time_limit_minutes: numQuestions * 2,
      questions: questionIds,
      security_settings: {
        require_fullscreen: true,
        max_tab_switches: 3
      }
    });

    await exam.save();
    return await Exam.findById(exam._id).populate('questions');
  } catch (error) {
    console.error("Lỗi khi sinh đề thi bằng Gemini:", error.message);
    throw error;
  }
};
```

### 6.2. [backend/services/tutorService.js](file:///d:/webkiemtratoan/backend/services/tutorService.js)
```javascript
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
let groqClient = null;

if (apiKey && apiKey !== 'your_groq_key_here') {
  try {
    groqClient = new Groq({ apiKey });
    console.log("=== Khởi tạo thành công Gia sư Chat bằng Groq ===");
  } catch (error) {
    console.error("Lỗi khi cấu hình Groq SDK:", error.message);
  }
} else {
  console.log("=== Cảnh báo: Chưa cấu hình GROQ_API_KEY thực tế. Đang chạy Gia sư Chat ở chế độ mô phỏng (Mock mode) ===");
}

export const chatWithSocraticTutor = async (chatHistory) => {
  try {
    if (!groqClient) {
      console.log("Mô phỏng phản hồi từ Groq Socratic Tutor...");
      const lastUserMsg = chatHistory[chatHistory.length - 1]?.content || '';
      return `[Gia sư ảo Llama3 - Mô phỏng]: Bạn đang hỏi về: "${lastUserMsg}". Để giải quyết bài này, trước tiên bạn hãy xem xét xem điều kiện xác định của phương trình là gì? Cụ thể là biểu thức dưới dấu căn cần điều kiện gì nào?`;
    }

    const systemPrompt = {
      role: 'system',
      content: `Bạn là một gia sư Toán học Socratic (Socratic Math Tutor) thân thiện và kiên nhẫn dành cho học sinh THPT Việt Nam.
Nhiệm vụ của bạn là dẫn dắt học sinh tự tìm ra câu trả lời bằng cách đặt các câu hỏi gợi mở hoặc đưa ra các bước nhỏ (Socratic Method).
QUY TẮC CỐT LÕI:
1. KHÔNG được đưa ra lời giải chi tiết hoặc đáp án cuối cùng ngay lập tức.
2. Trả lời bằng tiếng Việt thân thiện, dễ thương, gọi học sinh là "bạn" hoặc "em", xưng là "gia sư" hoặc "mình".
3. Luôn sử dụng định dạng LaTeX cho tất cả các biểu thức toán học (ví dụ: $y = f(x)$ hoặc $\\int_0^1 x dx$).
4. Nếu học sinh hoàn toàn bế tắc sau nhiều bước gợi ý, bạn mới trình bày một phần lời giải để làm mẫu.`
    };

    const messages = [systemPrompt, ...chatHistory];

    const chatCompletion = await groqClient.chat.completions.create({
      messages: messages,
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false
    });

    return chatCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Lỗi khi kết nối với API Groq:", error.message);
    return "Gia sư ảo đang gặp lỗi kết nối. Bạn hãy xem lại hướng đi cơ bản của bài toán nhé!";
  }
};
```

---

## 7. Chi tiết mã nguồn - FRONTEND

### 7.1. [frontend/index.html](file:///d:/webkiemtratoan/frontend/index.html)
```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hệ thống Ôn thi Toán THPT Thông minh</title>
    <!-- Google Font Plus Jakarta Sans -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- KaTeX CSS & JS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 7.2. [frontend/src/index.css](file:///d:/webkiemtratoan/frontend/src/index.css)
```css
:root {
  --bg-color: #0b0f19;
  --panel-bg: rgba(17, 24, 39, 0.7);
  --panel-border: rgba(255, 255, 255, 0.08);
  
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --primary-glow: rgba(79, 70, 229, 0.4);
  
  --secondary: #06b6d4;
  --secondary-glow: rgba(6, 182, 212, 0.3);
  
  --text-main: #f3f4f6;
  --text-muted: #9ca3af;
  --text-dark: #111827;
  
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --danger-glow: rgba(239, 68, 68, 0.3);

  --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background-color: var(--bg-color);
  color: var(--text-main);
  background-image: 
    radial-gradient(at 10% 20%, rgba(79, 70, 229, 0.15) 0px, transparent 50%),
    radial-gradient(at 90% 80%, rgba(6, 182, 212, 0.12) 0px, transparent 50%);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Layout Utilities */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.glass-panel {
  background: var(--panel-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-panel:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

/* Typography & Headings */
h1, h2, h3, h4 {
  font-weight: 700;
  letter-spacing: -0.025em;
  color: #ffffff;
}

h1 {
  font-size: 2.5rem;
  background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

p {
  color: var(--text-muted);
  line-height: 1.6;
}

/* Navigation Tab Bar */
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 1.5rem;
}

.nav-logo {
  font-size: 1.25rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #818cf8 0%, #22d3ee 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
}

.nav-tab {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 0.6rem 1.2rem;
  font-family: var(--font-family);
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.nav-tab.active {
  color: #ffffff;
  background: rgba(79, 70, 229, 0.2);
  border: 1px solid rgba(79, 70, 229, 0.4);
  box-shadow: 0 0 12px var(--primary-glow);
}

/* Dashboard Grid Styles */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.profile-card {
  padding: 1.5rem;
  text-align: center;
}

.avatar-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  margin: 0 auto 1rem auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  box-shadow: 0 0 20px rgba(79, 70, 229, 0.5);
}

.profile-name {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.profile-email {
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

/* Knowledge Matrix Progress Bars */
.matrix-section {
  text-align: left;
  border-top: 1px solid var(--panel-border);
  padding-top: 1.5rem;
  margin-top: 1.5rem;
}

.matrix-title {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.matrix-item {
  margin-bottom: 1rem;
}

.matrix-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: 0.4rem;
  font-weight: 500;
}

.topic-name {
  text-transform: capitalize;
  color: var(--text-main);
}

.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 1s ease-out;
}

.progress-fill.poor {
  background: linear-gradient(90deg, #f87171, var(--danger));
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
}
.progress-fill.fair {
  background: linear-gradient(90deg, #fbbf24, var(--warning));
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}
.progress-fill.good {
  background: linear-gradient(90deg, #34d399, var(--success));
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

/* Exam Card Listings */
.exams-section {
  padding: 1.5rem;
}

.exams-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.btn {
  font-family: var(--font-family);
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 4px 14px var(--primary-glow);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  box-shadow: 0 6px 20px var(--primary-glow);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--panel-border);
  color: var(--text-main);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.exams-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 600px) {
  .exams-list {
    grid-template-columns: 1fr;
  }
}

.exam-card {
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.exam-title {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.exam-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 1.25rem;
}

.exam-meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Attempt History List */
.history-section {
  grid-column: 1 / -1;
  padding: 1.5rem;
}

.history-table-wrapper {
  overflow-x: auto;
  margin-top: 1rem;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.history-table th, .history-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--panel-border);
}

.history-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.85rem;
}

.history-table td {
  font-size: 0.9rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 20px;
}

.badge-success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.badge-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* Quiz Runner Styles */
.quiz-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--panel-border);
}

.timer {
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ffffff;
  padding: 0.4rem 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.timer.warning {
  color: var(--danger);
  animation: pulse 1s infinite alternate;
}

.quiz-question-box {
  padding: 1.5rem 0;
}

.question-text {
  font-size: 1.25rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  color: #ffffff;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-button {
  width: 100%;
  text-align: left;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  color: var(--text-main);
  font-family: var(--font-family);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.option-button:hover:not(:disabled) {
  background: rgba(79, 70, 229, 0.08);
  border-color: rgba(79, 70, 229, 0.4);
}

.option-button.selected {
  background: rgba(79, 70, 229, 0.15);
  border-color: var(--primary);
  box-shadow: 0 0 10px var(--primary-glow);
}

.option-label {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: #ffffff;
}

.option-button.selected .option-label {
  background: var(--primary);
}

.quiz-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--panel-border);
}

/* Socratic Hint Popup Alert */
.hint-alert {
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 12px;
  padding: 1.25rem;
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  animation: slideIn 0.3s ease-out;
}

.hint-icon {
  color: var(--secondary);
  flex-shrink: 0;
  margin-top: 0.2rem;
}

.hint-content h4 {
  color: #ffffff;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.hint-content p {
  color: #e2e8f0;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Quiz Finished Scorecard */
.score-card {
  text-align: center;
  padding: 2.5rem 1.5rem;
}

.score-badge {
  width: 100px;
  height: 100px;
  border-radius: 50px;
  background: linear-gradient(135deg, var(--success) 0%, #34d399 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0 auto 1.5rem auto;
  box-shadow: 0 0 25px rgba(16, 185, 129, 0.4);
}

.ai-report-box {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: left;
}

.ai-report-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.15rem;
  margin-bottom: 1rem;
  color: #ffffff;
}

.ai-report-block {
  margin-bottom: 1.25rem;
}

.ai-report-block h5 {
  font-size: 0.95rem;
  color: var(--secondary);
  margin-bottom: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ai-report-block p {
  color: #e2e8f0;
  font-size: 0.925rem;
  line-height: 1.6;
}

/* Socratic Tutor Chatbox */
.chat-container {
  max-width: 800px;
  margin: 0 auto;
  height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-bubble {
  max-width: 75%;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.6;
  animation: fadeIn 0.2s ease-out;
}

.chat-bubble.user {
  align-self: flex-end;
  background: var(--primary);
  color: #ffffff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.chat-bubble.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--panel-border);
  color: #e2e8f0;
  border-bottom-left-radius: 4px;
}

.chat-input-area {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--panel-border);
  display: flex;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

.chat-input {
  flex-grow: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: #ffffff;
  font-family: var(--font-family);
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.chat-input:focus {
  outline: none;
  border-color: var(--primary);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 10px var(--primary-glow);
}

/* Animations */
@keyframes pulse {
  from { box-shadow: 0 0 8px var(--danger-glow); }
  to { box-shadow: 0 0 16px rgba(239, 68, 68, 0.6); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 7.3. [frontend/src/components/Login.jsx](file:///d:/webkiemtratoan/frontend/src/components/Login.jsx)
```javascript
import React, { useState } from 'react';
import { LogIn, GraduationCap, Mail, User, Info } from 'lucide-react';

export default function Login({ onLogin }) {
  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const query = emailInput.trim();
    if (!query) return;

    setLoading(true);

    if (query === 'admin' || query.toLowerCase() === 'admin@gmail.com') {
      setTimeout(() => {
        onLogin(null, 'admin');
        setLoading(false);
      }, 500);
      return;
    }

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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600', color: '#ffffff' }}>
              Tên đăng nhập hoặc Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={16} 
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
              />
              <input 
                type="text"
                required
                className="chat-input"
                style={{ width: '100%', paddingLeft: '38px' }}
                placeholder="Nhập 'admin' hoặc email học sinh..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

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

        <div 
          style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '8px',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            fontSize: '0.8rem',
            lineHeight: '1.5'
          }}
        >
          <Info size={18} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.25rem' }}>Hướng dẫn đăng nhập nhanh:</div>
            <ul style={{ paddingLeft: '1rem', color: 'var(--text-muted)' }}>
              <li>Nhập <code style={{ color: 'var(--secondary)', fontWeight: '700' }}>admin</code> để vào trang Quản trị của Giáo viên.</li>
              <li>Nhập <code style={{ color: 'var(--secondary)', fontWeight: '700' }}>vana@gmail.com</code> để vào học sinh Nguyễn Văn A.</li>
              <li>Hoặc nhập bất kỳ Email/Tên nào khác để tự tạo một tài khoản học sinh mới.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 7.4. [frontend/src/components/Dashboard.jsx](file:///d:/webkiemtratoan/frontend/src/components/Dashboard.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import { BookOpen, Award, ShieldAlert, Sparkles, RefreshCw, Calendar, Clock, AlertTriangle } from 'lucide-react';

export default function Dashboard({ userId, onStartExam, activeAttemptId }) {
  const [user, setUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch('http://localhost:3000/api/users');
      const users = await userRes.json();
      if (users && users.length > 0) {
        const activeUser = users.find(u => u._id === userId) || users[0];
        setUser(activeUser);
      }

      const examRes = await fetch('http://localhost:3000/api/exams');
      const examsData = await examRes.json();
      setExams(examsData);

      const historyRes = await fetch('http://localhost:3000/api/test-attempts');
      const historyData = await historyRes.json();
      if (users && users.length > 0) {
        const activeUserId = userId || users[0]._id;
        const userHistory = historyData
          .filter(h => h.user_id && h.user_id._id === activeUserId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHistory(userHistory);
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeAttemptId, userId]);

  const handleGenerateExam = async () => {
    try {
      setGenerating(true);
      const res = await fetch('http://localhost:3000/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Đề thi Thích ứng AI - Chủ đề Cực trị (${new Date().toLocaleDateString('vi-VN')})`,
          topicId: 'cuc_tri_ham_so',
          difficulty: 7,
          numQuestions: 3
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchDashboardData();
      } else {
        alert(`Lỗi sinh đề: ${data.error}`);
      }
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

  const matrixArray = user?.knowledge_matrix ? Object.entries(user.knowledge_matrix) : [];

  const getProgressClass = (score) => {
    if (score < 5.0) return 'poor';
    if (score < 8.0) return 'fair';
    return 'good';
  };

  return (
    <div className="dashboard-grid">
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
  );
}
```

### 7.5. [frontend/src/components/QuizRunner.jsx](file:///d:/webkiemtratoan/frontend/src/components/QuizRunner.jsx)
```javascript
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Timer, HelpCircle, CheckCircle, XCircle, ArrowRight, BookOpen, AlertOctagon, Brain } from 'lucide-react';

export default function QuizRunner({ attemptId, examId, userId, onFinish }) {
  const [exam, setExam] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState('');
  const [answeredMap, setAnsweredMap] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [cheats, setCheats] = useState({ tabSwitches: 0, fullscreenExits: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const questionRef = useRef(null);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/exams`);
        const data = await res.json();
        const activeExam = data.find(e => e._id === examId);
        setExam(activeExam);
        setTimeLeft((activeExam?.time_limit_minutes || 45) * 60);
      } catch (error) {
        console.error("Lỗi khi tải đề thi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [examId]);

  useEffect(() => {
    if (questionRef.current && window.renderMathInElement) {
      window.renderMathInElement(questionRef.current, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ]
      });
    }
  }, [currentIdx, exam, answeredMap]);

  useEffect(() => {
    if (submitted || timeLeft <= 0 || loading) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, submitted, loading]);

  useEffect(() => {
    if (submitted || loading) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        setCheats(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
        try {
          await fetch(`http://localhost:3000/api/test-attempts/${attemptId}/cheat-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'tab_switch',
              details: 'Học sinh chuyển đổi cửa sổ/tab trình duyệt'
            })
          });
        } catch (err) {
          console.error("Lỗi log gian lận:", err);
        }
        alert("CẢNH BÁO GIAN LẬN: Hệ thống phát hiện bạn đã thoát/chuyển đổi tab! Hành vi này đã bị ghi lại.");
      }
    };

    const handleFullscreenChange = async () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );

      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && !submitted) {
        setCheats(prev => ({ ...prev, fullscreenExits: prev.fullscreenExits + 1 }));
        try {
          await fetch(`http://localhost:3000/api/test-attempts/${attemptId}/cheat-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'fullscreen_exit',
              details: 'Học sinh thoát chế độ toàn màn hình'
            })
          });
        } catch (err) {
          console.error("Lỗi log gian lận:", err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [attemptId, submitted, loading]);

  const enterFullscreen = () => {
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) {
      docElm.requestFullscreen();
    } else if (docElm.mozRequestFullScreen) {
      docElm.mozRequestFullScreen();
    } else if (docElm.webkitRequestFullScreen) {
      docElm.webkitRequestFullScreen();
    }
    setIsFullscreen(true);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAns) return;
    const currentQuestion = exam.questions[currentIdx];

    try {
      const res = await fetch(`http://localhost:3000/api/exams/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId: currentQuestion._id,
          selectedAnswer: selectedAns,
          timeSpentSeconds: 30
        })
      });
      const data = await res.json();
      
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

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/exams/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId })
      });
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (error) {
      console.error("Lỗi nộp bài:", error);
      alert("Nộp bài thi thất bại do lỗi kết nối.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    alert("Đã hết thời gian làm bài! Hệ thống tự động nộp bài thi.");
    handleFinalSubmit();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '0.5rem' }}>
        <Timer className="animate-spin" /> Đang thiết lập phòng thi...
      </div>
    );
  }

  if (!isFullscreen && !submitted) {
    return (
      <div className="glass-panel quiz-container" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <Shield size={64} style={{ color: 'var(--primary)', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 15px var(--primary-glow))' }} />
        <h2 style={{ marginBottom: '1rem' }}>Bảo mật Phòng thi Trực tuyến</h2>
        <p style={{ marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
          Đề thi này yêu cầu kích hoạt chế độ **Toàn màn hình** để bắt đầu. 
          Các hành vi thoát màn hình hoặc chuyển tab sẽ bị ghi nhận trực tiếp vào báo cáo chống gian lận gửi tới giáo viên.
        </p>
        <button className="btn btn-primary" onClick={enterFullscreen}>
          Kích hoạt Toàn màn hình & Bắt đầu làm bài
        </button>
      </div>
    );
  }

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

        {result.ai_report && (
          <div className="ai-report-box">
            <h4 className="ai-report-title">
              <Brain size={20} style={{ color: 'var(--secondary)' }} />
              Phân tích học lực từ AI (Gemini)
            </h4>
            
            <div className="ai-report-block">
              <h5>Phân tích điểm yếu & Lỗi tư duy</h5>
              <p>{result.ai_report.ai_evaluation}</p>
            </div>

            <div className="ai-report-block" style={{ marginTop: '1.5rem' }}>
              <h5>Định hướng ôn luyện chi tiết</h5>
              <p>{result.ai_report.socratic_tutoring}</p>
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

      {(cheats.tabSwitches > 0 || cheats.fullscreenExits > 0) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
          <AlertOctagon size={16} />
          Phát hiện {cheats.tabSwitches + cheats.fullscreenExits} hành vi bất thường (Chuyển tab: {cheats.tabSwitches}, Thoát toàn màn hình: {cheats.fullscreenExits}).
        </div>
      )}

      <div className="quiz-question-box">
        <div className="question-text">
          {currentQuestion?.content}
        </div>
        
        <div className="options-list">
          {currentQuestion && Object.entries(currentQuestion.options).map(([key, val]) => {
            const isSelected = selectedAns === key;
            const isCorrectAnswer = currentQuestion.correct_answer === key;
            
            let btnClass = '';
            if (isSelected) btnClass = 'selected';
            
            let icon = null;
            if (hasAnswered) {
              if (isCorrectAnswer) {
                btnClass = 'selected';
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
                <span>{val}</span>
                {icon}
              </button>
            );
          })}
        </div>
      </div>

      {hasAnswered && !answeredInfo.isCorrect && answeredInfo.socraticHint && (
        <div className="hint-alert">
          <HelpCircle className="hint-icon" size={20} />
          <div className="hint-content">
            <h4>Gợi ý gia sư ảo Socratic</h4>
            <p>{answeredInfo.socraticHint}</p>
          </div>
        </div>
      )}

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
    </div>
  );
}
```

### 7.6. [frontend/src/components/TutorChat.jsx](file:///d:/webkiemtratoan/frontend/src/components/TutorChat.jsx)
```javascript
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatContainerRef.current && window.renderMathInElement) {
      window.renderMathInElement(chatContainerRef.current, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ]
      });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = { role: 'user', content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3000/api/tutor/chat', {
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
              <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
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
```

### 7.7. [frontend/src/components/AdminDashboard.jsx](file:///d:/webkiemtratoan/frontend/src/components/AdminDashboard.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import { Users, ShieldAlert, BookOpen, Trash2, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('students');
  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  
  const [newExamTitle, setNewExamTitle] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('cuc_tri_ham_so');
  const [difficulty, setDifficulty] = useState(6);
  const [numQuestions, setNumQuestions] = useState(3);
  const [generating, setGenerating] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch('http://localhost:3000/api/users');
      const usersData = await userRes.json();
      setUsers(usersData);

      const examRes = await fetch('http://localhost:3000/api/exams');
      const examsData = await examRes.json();
      setExams(examsData);

      const attemptRes = await fetch('http://localhost:3000/api/test-attempts');
      const attemptsData = await attemptRes.json();
      setAttempts(attemptsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error("Lỗi tải dữ liệu quản trị:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.")) return;
    
    try {
      const res = await fetch(`http://localhost:3000/api/exams/${examId}`, {
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

  const handleCreateAIExam = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const res = await fetch('http://localhost:3000/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newExamTitle || `Đề thích ứng AI - Chủ đề ${selectedTopic.replace(/_/g, ' ')}`,
          topicId: selectedTopic,
          difficulty: parseInt(difficulty),
          numQuestions: parseInt(numQuestions)
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setNewExamTitle('');
        fetchAdminData();
      } else {
        alert(`Lỗi sinh đề: ${data.error}`);
      }
    } catch (error) {
      console.error("Lỗi kết nối AI sinh đề:", error);
    } finally {
      setGenerating(false);
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
      <div className="glass-panel" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem' }}>
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
      </div>

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

      {activeSubTab === 'exams' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
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
                  <option value="cuc_tri_ham_so">Cực trị của hàm số</option>
                  <option value="tich_phan_co_ban">Tích phân cơ bản</option>
                  <option value="dao_ham">Ứng dụng đạo hàm</option>
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
                    style={{ width: '100%' }}
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: '600' }}>Số câu hỏi sinh ra</label>
                  <input 
                    type="number" 
                    min="1"
                    max="10"
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
    </div>
  );
}
```

### 7.8. [frontend/src/App.jsx](file:///d:/webkiemtratoan/frontend/src/App.jsx)
```javascript
import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import QuizRunner from './components/QuizRunner';
import TutorChat from './components/TutorChat';
import AdminDashboard from './components/AdminDashboard';
import { LayoutDashboard, MessageSquare, GraduationCap, UserCog, LogOut } from 'lucide-react';

function App() {
  const [role, setRole] = useState(null); // null | 'student' | 'admin'
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inExam, setInExam] = useState(false);
  const [examConfig, setExamConfig] = useState({ userId: null, examId: null, attemptId: null });

  const handleLogin = (user, userRole) => {
    setCurrentUser(user);
    setRole(userRole);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    if (inExam) {
      if (!window.confirm("Bạn đang trong phòng thi! Đăng xuất sẽ hủy bài làm hiện tại. Bạn có chắc chắn muốn đăng xuất không?")) {
        return;
      }
    }
    setRole(null);
    setCurrentUser(null);
    setInExam(false);
    setExamConfig({ userId: null, examId: null, attemptId: null });
  };

  const handleStartExam = async (userId, examId) => {
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
      }
    } catch (error) {
      console.error("Lỗi khi kết nối bắt đầu thi:", error);
      alert("Lỗi kết nối đến máy chủ.");
    }
  };

  const handleFinishExam = () => {
    setInExam(false);
    setExamConfig({ userId: null, examId: null, attemptId: null });
    setActiveTab('dashboard');
  };

  if (role === null) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="container">
      {inExam ? (
        <QuizRunner
          userId={examConfig.userId}
          examId={examConfig.examId}
          attemptId={examConfig.attemptId}
          onFinish={handleFinishExam}
        />
      ) : (
        <>
          <div className="glass-panel nav-bar">
            <div className="nav-logo">
              <GraduationCap size={24} style={{ strokeWidth: 2.5 }} />
              <span>Học Toán THPT AI</span>
            </div>

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

            {role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--secondary)' }}>
                <UserCog size={18} />
                BẢNG QUẢN TRỊ GIÁO VIÊN
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
```
