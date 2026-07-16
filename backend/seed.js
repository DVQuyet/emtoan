import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import Models
import User from './models/User.js';
import Question from './models/Question.js';
import Topic from './models/Topic.js';
import Exam from './models/Exam.js';
import TestAttempt from './models/TestAttempt.js';

dotenv.config();

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("Lỗi: MONGO_URI không được tìm thấy trong tệp .env");
  process.exit(1);
}

const seedData = async () => {
  try {
    console.log(`=== Bắt đầu nạp dữ liệu mẫu tới database ===`);
    await mongoose.connect(mongoURI);
    console.log("Đã kết nối thành công tới database!");

    // Xóa dữ liệu cũ
    console.log("Đang xóa dữ liệu cũ...");
    await User.deleteMany({});
    await Question.deleteMany({});
    await Topic.deleteMany({});
    await Exam.deleteMany({});
    await TestAttempt.deleteMany({});

    // 1. Tạo Topics
    console.log("Đang nạp dữ liệu Topics...");
    await Topic.insertMany([
      {
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123456"),
        topic_id: "cuc_tri_ham_so",
        name: "Cực trị của hàm số",
        chapter: "Ứng dụng đạo hàm",
        grade: 12,
        prerequisites: ["tinh_dao_ham", "xet_dau_da_thuc"]
      },
      {
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123457"),
        topic_id: "tich_phan_co_ban",
        name: "Tích phân cơ bản",
        chapter: "Nguyên hàm và Tích phân",
        grade: 12,
        prerequisites: ["nguyen_ham_co_ban"]
      }
    ]);

    // 2. Tạo Questions
    console.log("Đang nạp dữ liệu Questions...");
    await Question.insertMany([
      {
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123458"),
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
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123459"),
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

    // 3. Tạo Users
    console.log("Đang nạp dữ liệu Users...");
    await User.insertMany([
      {
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123450"),
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

    // 4. Tạo Exams
    console.log("Đang nạp dữ liệu Exams...");
    await Exam.insertMany([
      {
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec12345a"),
        title: "Đề Khảo sát chất lượng Toán 12 - Lần 1",
        exam_type: "diagnostic",
        time_limit_minutes: 90,
        questions: [
          new mongoose.Types.ObjectId("60d5ec49c63d5830ec123458"),
          new mongoose.Types.ObjectId("60d5ec49c63d5830ec123459")
        ],
        security_settings: {
          require_fullscreen: true,
          max_tab_switches: 3
        }
      }
    ]);

    // 5. Tạo TestAttempts
    console.log("Đang nạp dữ liệu TestAttempts...");
    await TestAttempt.insertMany([
      {
        _id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec12345b"),
        user_id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123450"),
        exam_id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec12345a"),
        start_time: new Date("2026-07-06T19:00:00Z"),
        end_time: new Date("2026-07-06T20:30:00Z"),
        details: [
          {
            question_id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123458"),
            selected_answer: "B",
            is_correct: true,
            time_spent_seconds: 45
          },
          {
            question_id: new mongoose.Types.ObjectId("60d5ec49c63d5830ec123459"),
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

    console.log("=== NẠP DỮ LIỆU MẪU THÀNH CÔNG VÀO DATABASE ===");
    await mongoose.disconnect();
  } catch (error) {
    console.error("Lỗi khi nạp dữ liệu mẫu:", error);
    process.exit(1);
  }
};

seedData();
