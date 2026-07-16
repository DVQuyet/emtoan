import express from 'express';
import { chatWithSocraticTutor } from '../services/tutorService.js';
import { getKnowledgeSummaryFromGemini } from '../services/aiService.js';
import KnowledgeSummary from '../models/KnowledgeSummary.js';
import Topic from '../models/Topic.js';

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

// POST /api/tutor/knowledge-summary - Lấy hoặc sinh tổng hợp kiến thức chủ đề thi
router.post('/knowledge-summary', async (req, res) => {
  const { topicId, stream } = req.body;
  const isStream = stream === true || stream === 'true';

  if (!isStream) {
    try {
      if (!topicId) return res.status(400).json({ error: 'Thiếu thông tin mã chủ đề (topicId).' });
      
      let summary = await KnowledgeSummary.findOne({ topic_id: topicId });
      if (summary) {
        return res.json({
          message: 'Lấy kiến thức tổng hợp thành công (từ bộ nhớ đệm)!',
          summary: summary.content,
          topicName: summary.topic_name
        });
      }

      const topic = await Topic.findOne({ topic_id: topicId });
      const topicName = topic ? topic.name : topicId.replace(/_/g, ' ');

      console.log(`Đang yêu cầu Gemini tổng hợp kiến thức cho chủ đề: ${topicName} (${topicId})...`);
      const generatedContent = await getKnowledgeSummaryFromGemini(topicId, topicName);

      summary = new KnowledgeSummary({
        topic_id: topicId,
        topic_name: topicName,
        content: generatedContent
      });
      await summary.save();

      return res.json({
        message: 'AI đã tổng hợp kiến thức chủ đề thành công!',
        summary: generatedContent,
        topicName
      });
    } catch (error) {
      console.error("Lỗi tổng hợp kiến thức AI:", error);
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
      writeProgress('error', 'validate', 'Thiếu thông tin mã chủ đề (topicId).');
      return res.end();
    }

    writeProgress('progress', 'init', 'Bắt đầu lấy tài liệu tổng hợp kiến thức chủ đề...');
    
    let summary = await KnowledgeSummary.findOne({ topic_id: topicId });
    if (summary) {
      writeProgress('success', 'complete', 'Tìm thấy tài liệu trong kho lưu trữ dữ liệu (bộ nhớ đệm)!');
      res.write(JSON.stringify({
        status: 'success',
        data: {
          message: 'Lấy kiến thức tổng hợp thành công (từ bộ nhớ đệm)!',
          summary: summary.content,
          topicName: summary.topic_name
        }
      }) + '\n');
      return res.end();
    }

    const topic = await Topic.findOne({ topic_id: topicId });
    const topicName = topic ? topic.name : topicId.replace(/_/g, ' ');

    writeProgress('progress', 'call_ai', `Yêu cầu AI (Gemini) biên soạn tài liệu kiến thức cốt lõi cho chủ đề "${topicName}" (quá trình này có thể mất 5-10 giây)...`);
    const generatedContent = await getKnowledgeSummaryFromGemini(topicId, topicName);

    writeProgress('progress', 'save_db', 'Đang lưu trữ tài liệu vào cơ sở dữ liệu để tra cứu nhanh cho lần sau...');
    summary = new KnowledgeSummary({
      topic_id: topicId,
      topic_name: topicName,
      content: generatedContent
    });
    await summary.save();

    writeProgress('success', 'complete', 'Đã hoàn thành biên soạn và lưu trữ tài liệu!');
    res.write(JSON.stringify({
      status: 'success',
      data: {
        message: 'AI đã tổng hợp kiến thức chủ đề thành công!',
        summary: generatedContent,
        topicName
      }
    }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ status: 'error', error: error.message }) + '\n');
    res.end();
  }
});

export default router;
