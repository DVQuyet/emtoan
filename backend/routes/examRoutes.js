import express from 'express';
import TestAttempt from '../models/TestAttempt.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import { analyzeAttempt, generateExamWithGemini, cloneQuestionWithGemini } from '../services/aiService.js';

const router = express.Router();

// POST /api/exams/start - Khởi tạo phiên làm bài thi mới
router.post('/start', async (req, res) => {
  try {
    const { userId, examId } = req.body;

    if (!userId || !examId) {
      return res.status(400).json({ error: 'Thiếu thông tin userId hoặc examId' });
    }

    // Kiểm tra xem user và exam có tồn tại không
    const user = await User.findById(userId);
    const exam = await Exam.findById(examId);

    if (!user || !exam) {
      return res.status(404).json({ error: 'Không tìm thấy học sinh hoặc đề thi tương ứng' });
    }

    // Tạo bản ghi TestAttempt mới
    const attempt = new TestAttempt({
      user_id: userId,
      exam_id: examId,
      start_time: new Date(),
      end_time: new Date(), // Sẽ cập nhật khi nộp bài
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

// POST /api/exams/submit-answer - Nộp đáp án cho từng câu hỏi (trong lúc làm bài)
router.post('/submit-answer', async (req, res) => {
  try {
    const { attemptId, questionId, selectedAnswer, timeSpentSeconds } = req.body;

    if (!attemptId || !questionId || !selectedAnswer) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc (attemptId, questionId, selectedAnswer)' });
    }

    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Không tìm thấy phiên làm bài thi' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });
    }

    // Kiểm tra đáp án
    const isCorrect = (question.correct_answer === selectedAnswer);

    // Cập nhật câu trả lời vào details (nếu câu hỏi đã trả lời thì cập nhật, chưa thì thêm mới)
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

// GET /api/exams/:id/adaptive - Lấy đề thi thích ứng (thế các câu đã làm sai bằng câu tương tự)
router.get('/:id/adaptive', async (req, res) => {
  const { id } = req.params;
  const { userId, attemptId, stream } = req.query;
  const isStream = stream === 'true';

  if (!isStream) {
    try {
      const exam = await Exam.findById(id).populate('questions');
      if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi' });
      if (!userId) return res.json(exam);

      const query = { user_id: userId, exam_id: id };
      if (attemptId) query._id = { $ne: attemptId };

      const previousAttempt = await TestAttempt.findOne(query)
        .sort({ createdAt: -1 })
        .populate('details.question_id');
        
      if (!previousAttempt || previousAttempt.details.length === 0) return res.json(exam);

      const wrongQuestionIds = previousAttempt.details
        .filter(d => !d.is_correct)
        .map(d => d.question_id._id.toString());

      if (wrongQuestionIds.length === 0) return res.json(exam);

      console.log(`Học sinh ${userId} có ${wrongQuestionIds.length} câu làm sai ở đề ${id}. Tiến hành nhân bản thích ứng song song...`);

      const clonePromises = exam.questions.map(async (q) => {
        if (wrongQuestionIds.includes(q._id.toString())) {
          return await cloneQuestionWithGemini(q);
        } else {
          return q;
        }
      });
      const clonedQuestions = await Promise.all(clonePromises);

      const adaptiveExam = {
        ...exam.toObject(),
        questions: clonedQuestions
      };
      return res.json(adaptiveExam);
    } catch (error) {
      console.error("Lỗi khi tải đề thích ứng:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Streaming Mode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const writeProgress = (status, step, message) => {
    res.write(JSON.stringify({ status, step, message }) + '\n');
  };

  try {
    writeProgress('progress', 'init', 'Bắt đầu kết nối phòng thi thích ứng...');
    const exam = await Exam.findById(id).populate('questions');
    if (!exam) {
      writeProgress('error', 'not_found', 'Không tìm thấy đề thi');
      return res.end();
    }

    if (!userId) {
      writeProgress('success', 'complete', 'Tải đề thi mặc định thành công (Không truyền học sinh)');
      res.write(JSON.stringify({ status: 'success', data: exam }) + '\n');
      return res.end();
    }

    writeProgress('progress', 'fetch_prev', 'Đang phân tích lịch sử làm bài trước đó...');
    const query = { user_id: userId, exam_id: id };
    if (attemptId) query._id = { $ne: attemptId };

    const previousAttempt = await TestAttempt.findOne(query)
      .sort({ createdAt: -1 })
      .populate('details.question_id');
      
    if (!previousAttempt || previousAttempt.details.length === 0) {
      writeProgress('success', 'complete', 'Không phát hiện câu làm sai, sử dụng đề thi gốc!');
      res.write(JSON.stringify({ status: 'success', data: exam }) + '\n');
      return res.end();
    }

    const wrongQuestionIds = previousAttempt.details
      .filter(d => !d.is_correct)
      .map(d => d.question_id._id.toString());

    if (wrongQuestionIds.length === 0) {
      writeProgress('success', 'complete', 'Chúc mừng! Bài làm trước đạt điểm tối đa, tải đề thi gốc!');
      res.write(JSON.stringify({ status: 'success', data: exam }) + '\n');
      return res.end();
    }

    writeProgress('progress', 'clone_start', `Phát hiện ${wrongQuestionIds.length} câu làm sai. AI đang bắt đầu nhân bản các câu hỏi tương đương song song...`);

    const clonePromises = exam.questions.map(async (q, i) => {
      if (wrongQuestionIds.includes(q._id.toString())) {
        writeProgress('progress', `clone_${i}`, `Đang dùng AI nhân bản câu hỏi tương tự cho câu số ${i + 1}...`);
        return await cloneQuestionWithGemini(q);
      } else {
        return q;
      }
    });
    const clonedQuestions = await Promise.all(clonePromises);

    const adaptiveExam = {
      ...exam.toObject(),
      questions: clonedQuestions
    };

    writeProgress('success', 'complete', 'Hoàn tất thiết lập phòng thi thích ứng!');
    res.write(JSON.stringify({ status: 'success', data: adaptiveExam }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ status: 'error', error: error.message }) + '\n');
    res.end();
  }
});

// POST /api/exams/submit - Hoàn tất và nộp bài thi
router.post('/submit', async (req, res) => {
  const { attemptId, stream, isCheated } = req.body;
  const isStream = stream === true || stream === 'true';

  if (!isStream) {
    try {
      if (!attemptId) return res.status(400).json({ error: 'Thiếu attemptId' });
      const attempt = await TestAttempt.findById(attemptId);
      if (!attempt) return res.status(404).json({ error: 'Không tìm thấy phiên làm bài thi' });
      const exam = await Exam.findById(attempt.exam_id).populate('questions');
      if (!exam) return res.status(404).json({ error: 'Không tìm thấy cấu trúc đề thi tương ứng' });

      attempt.end_time = new Date();

      const totalQuestions = exam.questions.length;

      if (isCheated) {
        attempt.result_summary = {
          total_score: 0,
          topic_performance: {}
        };
        const user = await User.findById(attempt.user_id);
        if (user) {
          user.total_tests_taken += 1;
          const topicPerformance = new Map();
          for (const q of exam.questions) {
            const topic = q.metadata.topic || 'chung';
            if (!topicPerformance.has(topic)) {
              topicPerformance.set(topic, { correct: 0, total: 0 });
            }
            topicPerformance.get(topic).total += 1;
          }
          topicPerformance.forEach((stats, topic) => {
            const currentRating = user.knowledge_matrix.get(topic) || 5.0;
            const newRating = parseFloat((currentRating * 0.8).toFixed(2));
            user.knowledge_matrix.set(topic, newRating);
          });
          await user.save();
        }
        await attempt.save();
        const aiReport = {
          ai_evaluation: "Bài làm bị HỦY và nhận điểm 0 do vi phạm quy chế thi trực tuyến (hơn 3 lần thoát màn hình hoặc chuyển tab).",
          socratic_tutoring: "Bạn đã vi phạm quy chế thi bảo mật. Vui lòng làm bài trung thực ở lần thi tiếp theo và không thoát chế độ toàn màn hình."
        };
        return res.json({
          message: 'Bài thi đã bị dừng do vi phạm quy chế thi!',
          score: 0,
          correctAnswers: `0/${totalQuestions}`,
          result_summary: attempt.result_summary,
          knowledge_matrix_updated: user ? user.knowledge_matrix : null,
          ai_report: aiReport
        });
      }
      let correctCount = 0;
      const topicPerformance = new Map();

      for (const q of exam.questions) {
        const topic = q.metadata.topic || 'chung';
        const answer = attempt.details.find(d => d.question_id.toString() === q._id.toString());
        const isCorrect = answer ? answer.is_correct : false;
        if (isCorrect) correctCount++;

        if (!topicPerformance.has(topic)) {
          topicPerformance.set(topic, { correct: 0, total: 0 });
        }
        const stats = topicPerformance.get(topic);
        stats.total += 1;
        if (isCorrect) stats.correct += 1;
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
      const aiReport = await analyzeAttempt(attemptId);

      if (finalScore === 10) {
        try {
          const topic = exam.questions[0]?.metadata.topic || 'chung';
          const newTitle = `[Thử thách thích ứng] Đề ${exam.title} nâng cao`;
          const oldDifficulty = parseInt(exam.difficulty) || 6;
          const newDifficulty = Math.min(10, oldDifficulty + 1);
          generateExamWithGemini(newTitle, topic, newDifficulty, exam.questions.length).catch(e => {
            console.error("Lỗi tự động sinh đề nâng cao:", e);
          });
        } catch (err) {
          console.error("Lỗi tiền xử lý sinh đề thích ứng mới:", err);
        }
      }

      return res.json({
        message: 'Nộp bài thi thành công!',
        score: finalScore,
        correctAnswers: `${correctCount}/${totalQuestions}`,
        result_summary: attempt.result_summary,
        knowledge_matrix_updated: user ? user.knowledge_matrix : null,
        ai_report: aiReport
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Streaming Mode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const writeProgress = (status, step, message) => {
    res.write(JSON.stringify({ status, step, message }) + '\n');
  };

  try {
    if (!attemptId) {
      writeProgress('error', 'validate', 'Thiếu attemptId');
      return res.end();
    }

    writeProgress('progress', 'init', 'Bắt đầu nộp bài thi và tổng hợp kết quả...');
    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt) {
      writeProgress('error', 'not_found', 'Không tìm thấy phiên làm bài thi');
      return res.end();
    }

    const exam = await Exam.findById(attempt.exam_id).populate('questions');
    if (!exam) {
      writeProgress('error', 'not_found', 'Không tìm thấy cấu trúc đề thi tương ứng');
      return res.end();
    }

    attempt.end_time = new Date();
    const totalQuestions = exam.questions.length;

    if (isCheated) {
      writeProgress('progress', 'init', 'Ghi nhận hành vi vi phạm quy chế thi...');
      writeProgress('progress', 'grading', 'Hủy kết quả làm bài và đặt điểm số về 0...');
      attempt.result_summary = {
        total_score: 0,
        topic_performance: {}
      };
      writeProgress('progress', 'save_user', 'Cập nhật điểm số 0 vào học lực của bạn...');
      const user = await User.findById(attempt.user_id);
      if (user) {
        user.total_tests_taken += 1;
        const topicPerformance = new Map();
        for (const q of exam.questions) {
          const topic = q.metadata.topic || 'chung';
          if (!topicPerformance.has(topic)) {
            topicPerformance.set(topic, { correct: 0, total: 0 });
          }
          topicPerformance.get(topic).total += 1;
        }
        topicPerformance.forEach((stats, topic) => {
          const currentRating = user.knowledge_matrix.get(topic) || 5.0;
          const newRating = parseFloat((currentRating * 0.8).toFixed(2));
          user.knowledge_matrix.set(topic, newRating);
        });
        await user.save();
      }
      await attempt.save();

      const aiReport = {
        ai_evaluation: "Bài làm bị HỦY và nhận điểm 0 do vi phạm quy chế thi trực tuyến (hơn 3 lần thoát màn hình hoặc chuyển tab).",
        socratic_tutoring: "Bạn đã vi phạm quy chế thi bảo mật. Vui lòng làm bài trung thực ở lần thi tiếp theo và không thoát chế độ toàn màn hình."
      };

      writeProgress('success', 'complete', 'Nộp bài thi thành công!');
      res.write(JSON.stringify({
        status: 'success',
        data: {
          message: 'Bài thi đã bị dừng do vi phạm quy chế thi!',
          score: 0,
          correctAnswers: `0/${totalQuestions}`,
          result_summary: attempt.result_summary,
          knowledge_matrix_updated: user ? user.knowledge_matrix : null,
          ai_report: aiReport
        }
      }) + '\n');
      res.end();
      return;
    }

    writeProgress('progress', 'grading', 'Đang chấm điểm bài làm và tính toán điểm số...');
    let correctCount = 0;
    const topicPerformance = new Map();

    for (const q of exam.questions) {
      const topic = q.metadata.topic || 'chung';
      const answer = attempt.details.find(d => d.question_id.toString() === q._id.toString());
      const isCorrect = answer ? answer.is_correct : false;
      if (isCorrect) correctCount++;

      if (!topicPerformance.has(topic)) {
        topicPerformance.set(topic, { correct: 0, total: 0 });
      }
      const stats = topicPerformance.get(topic);
      stats.total += 1;
      if (isCorrect) stats.correct += 1;
    }

    const finalScore = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

    attempt.result_summary = {
      total_score: finalScore,
      topic_performance: Object.fromEntries(topicPerformance)
    };

    writeProgress('progress', 'save_user', 'Đang cập nhật Ma trận kiến thức học tập của bạn...');
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

    writeProgress('progress', 'call_ai', 'Đang liên kết AI để phân tích điểm yếu học lực của bạn...');
    const aiReport = await analyzeAttempt(attemptId, (step, message) => {
      writeProgress('progress', step, message);
    });

    if (finalScore === 10) {
      try {
        const topic = exam.questions[0]?.metadata.topic || 'chung';
        const newTitle = `[Thử thách thích ứng] Đề ${exam.title} nâng cao`;
        const oldDifficulty = parseInt(exam.difficulty) || 6;
        const newDifficulty = Math.min(10, oldDifficulty + 1);
        
        writeProgress('progress', 'auto_challenge', 'Bạn đạt điểm tối đa! AI đang chuẩn bị đề ôn tập nâng cao thử thách...');
        generateExamWithGemini(newTitle, topic, newDifficulty, exam.questions.length).catch(e => {
          console.error("Lỗi tự động sinh đề nâng cao:", e);
        });
      } catch (err) {
        console.error("Lỗi tiền xử lý sinh đề thích ứng mới:", err);
      }
    }

    writeProgress('success', 'complete', 'Nộp bài thi thành công!');
    res.write(JSON.stringify({
      status: 'success',
      data: {
        message: 'Nộp bài thi thành công!',
        score: finalScore,
        correctAnswers: `${correctCount}/${totalQuestions}`,
        result_summary: attempt.result_summary,
        knowledge_matrix_updated: user ? user.knowledge_matrix : null,
        ai_report: aiReport
      }
    }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ status: 'error', error: error.message }) + '\n');
    res.end();
  }
});

// POST /api/exams/generate - Sinh đề thi tự động bằng Gemini AI
router.post('/generate', async (req, res) => {
  const { title, topicId, difficulty, numQuestions, documentId, stream } = req.body;
  const isStream = stream === true || stream === 'true';

  if (!isStream) {
    try {
      if (!topicId) return res.status(400).json({ error: 'Thiếu thông tin chủ đề (topicId) để sinh đề thi' });
      const targetDifficulty = difficulty === 'random' ? 'random' : (difficulty ? parseInt(difficulty) : 5);
      const count = numQuestions ? parseInt(numQuestions) : 5;

      const exam = await generateExamWithGemini(title, topicId, targetDifficulty, count, documentId);
      return res.status(201).json({
        message: 'Sinh đề thi bằng Gemini thành công và đã lưu vào cơ sở dữ liệu!',
        exam
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Streaming Mode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const writeProgress = (status, step, message) => {
    res.write(JSON.stringify({ status, step, message }) + '\n');
  };

  try {
    if (!topicId) {
      writeProgress('error', 'validate', 'Thiếu thông tin chủ đề (topicId) để sinh đề thi');
      return res.end();
    }
    const targetDifficulty = difficulty === 'random' ? 'random' : (difficulty ? parseInt(difficulty) : 5);
    const count = numQuestions ? parseInt(numQuestions) : 5;

    writeProgress('progress', 'init', 'Bắt đầu quá trình khởi tạo sinh đề thi Toán...');
    const exam = await generateExamWithGemini(title, topicId, targetDifficulty, count, documentId, (step, message) => {
      writeProgress('progress', step, message);
    });

    writeProgress('success', 'complete', 'Sinh đề thi thành công!');
    res.write(JSON.stringify({
      status: 'success',
      data: {
        message: 'Sinh đề thi bằng Gemini thành công và đã lưu vào cơ sở dữ liệu!',
        exam
      }
    }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ status: 'error', error: error.message }) + '\n');
    res.end();
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
