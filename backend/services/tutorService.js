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

/**
 * Gửi tin nhắn lịch sử và trò chuyện với gia sư Socratic sử dụng Groq Llama 3
 * @param {Array} chatHistory - Mảng chứa lịch sử chat [{ role: 'user'|'assistant', content: '...' }]
 * @returns {Promise<string>} Phản hồi từ gia sư Socratic
 */
export const chatWithSocraticTutor = async (chatHistory) => {
  try {
    if (!groqClient) {
      console.log("Mô phỏng phản hồi từ Groq Socratic Tutor...");
      // Lấy câu hỏi cuối cùng của học sinh
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

    // Gộp system prompt vào đầu lịch sử chat
    const messages = [systemPrompt, ...chatHistory];

    const chatCompletion = await groqClient.chat.completions.create({
      messages: messages,
      // Sử dụng model Llama 3.1 tốc độ cao
      model: 'llama-3.1-8b-instant',
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
