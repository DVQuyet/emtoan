import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import TestAttempt from '../models/TestAttempt.js';
import User from '../models/User.js';
import Question from '../models/Question.js';
import Exam from '../models/Exam.js';
import ReferenceDoc from '../models/ReferenceDoc.js';

dotenv.config();

const apiKeys = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean) : [];
const apiKey = apiKeys[0];
const groqApiKey = process.env.GROQ_API_KEY;

let groqClient = null;
let geminiClients = [];
let activeClientIndex = 0;

const rotateGeminiKey = () => {
  if (geminiClients.length <= 1) return;
  activeClientIndex = (activeClientIndex + 1) % geminiClients.length;
  console.log(`=== [Key Rotation] Phát hiện lỗi rate-limit. Tự động xoay sang sử dụng API Key thứ ${activeClientIndex + 1}/${geminiClients.length} ===`);
};

// Cấu trúc quản lý trạng thái Circuit Breaker và Cooldown của các mô hình AI (Ưu tiên Flash trước)
const modelStates = {
  'gemini-3.5-flash': { name: 'gemini-3.5-flash', instance: null, status: 'CLOSED', cooldownUntil: 0, consecutiveFailures: 0, isProbing: false },
  'gemini-2.5-flash': { name: 'gemini-2.5-flash', instance: null, status: 'CLOSED', cooldownUntil: 0, consecutiveFailures: 0, isProbing: false },
  'gemini-flash-latest': { name: 'gemini-flash-latest', instance: null, status: 'CLOSED', cooldownUntil: 0, consecutiveFailures: 0, isProbing: false },
  'gemini-3.1-pro': { name: 'gemini-3.1-pro-preview', instance: null, status: 'CLOSED', cooldownUntil: 0, consecutiveFailures: 0, isProbing: false },
  'groq-llama-3.3': { name: 'llama-3.3-70b-versatile', status: 'CLOSED', cooldownUntil: 0, consecutiveFailures: 0, isProbing: false },
  'groq-llama-3.1': { name: 'llama-3.1-8b-instant', status: 'CLOSED', cooldownUntil: 0, consecutiveFailures: 0, isProbing: false }
};

let initPromise = null;

const initGeminiModels = async () => {
  if (apiKeys.length === 0 || apiKeys[0] === 'your_gemini_api_key_here') {
    console.log("=== Cảnh báo: Chưa có GEMINI_API_KEY thực tế. ===");
    return;
  }
  
  // Khởi tạo danh sách clients từ các keys được cấu hình
  geminiClients = apiKeys.map(key => new GoogleGenerativeAI(key));
  activeClientIndex = 0;

  try {
    // Gọi API để lấy danh sách các mô hình khả dụng thực tế của tài khoản (sử dụng key đầu tiên)
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeys[0]}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Google API returned status ${res.status}: ${data.error?.message || 'Unknown error'}`);
    }
    const availableModels = data.models ? data.models.map(m => m.name) : [];
    
    // Ánh xạ động các mô hình phù hợp từ Google
    if (availableModels.includes('models/gemini-3.1-pro-preview')) {
      modelStates['gemini-3.1-pro'].name = 'gemini-3.1-pro-preview';
    } else if (availableModels.includes('models/gemini-3.1-pro')) {
      modelStates['gemini-3.1-pro'].name = 'gemini-3.1-pro';
    } else {
      modelStates['gemini-3.1-pro'].name = 'gemini-2.5-pro';
    }

    if (availableModels.includes('models/gemini-3.5-flash')) {
      modelStates['gemini-3.5-flash'].name = 'gemini-3.5-flash';
    } else {
      modelStates['gemini-3.5-flash'].name = 'gemini-2.5-flash';
    }

    console.log(`=== Khởi tạo thành công các dịch vụ AI Gemini với ${geminiClients.length} keys (3.1 Pro -> ${modelStates['gemini-3.1-pro'].name}, 3.5 Flash -> ${modelStates['gemini-3.5-flash'].name}) ===`);
  } catch (error) {
    console.error("Lỗi khi kết nối Google API để lấy danh sách models, sử dụng danh sách mặc định:", error.message);
    modelStates['gemini-3.1-pro'].name = 'gemini-3.1-pro-preview';
    modelStates['gemini-3.5-flash'].name = 'gemini-3.5-flash';
  }
};

// Gán initPromise ngay lập tức khi load module để chạy ngầm
initPromise = initGeminiModels();

if (groqApiKey && groqApiKey !== 'your_groq_key_here') {
  try {
    groqClient = new Groq({ apiKey: groqApiKey });
    console.log("=== Khởi tạo thành công dịch vụ Groq fallback ===");
  } catch (error) {
    console.error("Lỗi khi cấu hình Groq SDK cho fallback:", error.message);
  }
} else {
  console.log("=== Cảnh báo: Chưa cấu hình GROQ_API_KEY thực tế. ===");
}

// Kiểm tra xem có bất kỳ cấu hình API Key nào để sẵn sàng chạy AI không
const isAiAvailable = () => {
  return !!(apiKey || groqApiKey);
};

// Cắt chuỗi an toàn tại vị trí xuống dòng hoặc dấu cách để tránh đứt gãy từ hoặc công thức LaTeX toán học dở dang
const truncateAtSafeBoundary = (text, maxChars) => {
  if (!text || text.length <= maxChars) return text;
  let index = text.lastIndexOf('\n', maxChars);
  if (index === -1 || index < maxChars * 0.7) {
    index = text.lastIndexOf(' ', maxChars);
  }
  if (index === -1) {
    index = maxChars;
  }
  return text.substring(0, index) + '\n... (Nội dung phía sau đã được tự động rút gọn tại vị trí thích hợp để bảo vệ công thức KaTeX và tối ưu token) ...';
};

// Wrapper ngắt kết nối (Abort Timeout) giúp ngăn chặn rò rỉ tài nguyên mạng và RAM
const withTimeout = (requestFn, ms, errorMessage = 'Timeout') => {
  const controller = new AbortController();
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(errorMessage));
      reject(new Error(errorMessage));
    }, ms);
  });

  return Promise.race([
    requestFn(controller.signal),
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));
};

// Tính toán Cooldown thích ứng hoặc áp dụng Exponential Backoff để ngắt cầu dao
const handleModelError = (state, error) => {
  state.consecutiveFailures += 1;
  let cooldownMs = 10000 * Math.pow(2, state.consecutiveFailures); // 10s, 20s, 40s...
  cooldownMs = Math.min(cooldownMs, 5 * 60 * 1000); // Tối đa 5 phút
  
  const errMsg = error.message?.toLowerCase() || '';
  
  if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate_limit')) {
    // Trích xuất retryDelay từ Google API response nếu có
    const match = errMsg.match(/retry(?:delay|\s+in)[\s:"]+([\d\.]+)/i);
    if (match && match[1]) {
      cooldownMs = Math.ceil(parseFloat(match[1])) * 1000;
      console.log(`[Circuit Breaker] Trích xuất chỉ dẫn chờ retryDelay từ lỗi 429: Chờ ${cooldownMs / 1000}s`);
    }
  } else if (errMsg.includes('404') || errMsg.includes('503')) {
    cooldownMs = 5 * 60 * 1000; // Sự cố hệ thống nghiêm trọng (Service Unavailable, Not Found): Ngắt cầu dao 5 phút
  } else if (errMsg.includes('timeout') || error.name === 'AbortError') {
    // Với lỗi timeout hoặc abort, sử dụng exponential backoff nhưng tối thiểu là 30s để tự phục hồi nhanh hơn
    cooldownMs = Math.max(cooldownMs, 30000);
  }

  state.status = 'OPEN';
  state.cooldownUntil = Date.now() + cooldownMs;
  console.warn(`[Circuit Breaker] Mở cầu dao (OPEN) cho ${state.name}. Thời gian khóa: ${cooldownMs/1000}s. Lỗi: ${error.message}`);
};

// Gọi SDK tương ứng với Signal Abort (Hỗ trợ cấu hình JSON Mode)
const callModelWithSignal = async (key, state, prompt, signal, isJson = false) => {
  if (key.startsWith('groq')) {
    if (!groqClient) throw new Error("Groq client not initialized");
    const options = {
      messages: [{ role: 'user', content: prompt }],
      model: state.name,
      temperature: 0.7,
      max_tokens: 4096,
    };
    if (isJson) {
      options.response_format = { type: "json_object" };
    }
    const chatCompletion = await groqClient.chat.completions.create(options, { signal });
    return chatCompletion.choices[0].message.content.trim();
  } else {
    if (geminiClients.length === 0) throw new Error("Google Gemini clients not initialized");
    
    let attempts = 0;
    const maxAttempts = geminiClients.length;
    
    while (attempts < maxAttempts) {
      const activeClient = geminiClients[activeClientIndex];
      const modelInstance = activeClient.getGenerativeModel({ model: state.name });
      
      try {
        const reqOptions = { signal };
        let request;
        if (isJson) {
          request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          };
        } else {
          request = prompt;
        }
        const result = await modelInstance.generateContent(request, reqOptions);
        return result.response.text().trim();
      } catch (error) {
        const errMsg = error.message?.toLowerCase() || '';
        const isRetryable = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate_limit') || errMsg.includes('503') || errMsg.includes('timeout') || error.name === 'AbortError';
        
        if (isRetryable && geminiClients.length > 1 && attempts < maxAttempts - 1) {
          attempts++;
          rotateGeminiKey();
          console.warn(`[Key Rotation] Phát hiện lỗi tạm thời (${error.message}). Đang thử lại với key dự phòng tiếp theo (lần thử ${attempts + 1}/${maxAttempts})...`);
          continue;
        }
        throw error;
      }
    }
  }
};

/**
 * Thực hiện gọi mô hình AI sinh nội dung với cơ chế Circuit Breaker, HALF_OPEN Lock và Fallback tự động
 * 
 * @param {string} prompt - Nội dung yêu cầu gửi cho AI
 * @returns {Promise<object>} Đối tượng chứa content, requestedModel, actualMappedName, và provider
 */
export const generateContentWithFallback = async (prompt, timeoutMs = 25000, isJson = false) => {
  await initPromise; // Đảm bảo danh sách mô hình đã được tải xong
  
  const modelKeys = Object.keys(modelStates);
  
  for (const key of modelKeys) {
    const state = modelStates[key];
    
    // 1. Kiểm tra trạng thái cầu dao OPEN
    if (state.status === 'OPEN') {
      if (Date.now() < state.cooldownUntil) {
        continue; // Đang trong thời gian khóa cooldown -> Bỏ qua ngay lập tức
      }
      
      // Đã hết cooldown -> Thử nghiệm lại (HALF_OPEN)
      if (state.isProbing) {
        continue; // Tránh Thundering Herd: Request khác đang probe rồi -> Bỏ qua
      }
      
      state.isProbing = true;
      console.log(`[Circuit Breaker] Thử nghiệm lại mô hình ${state.name} (HALF_OPEN)...`);
    }

    try {
      // 2. Thực hiện gọi API kèm AbortController và Timeout động
      const resultText = await withTimeout((signal) => {
        return callModelWithSignal(key, state, prompt, signal, isJson);
      }, timeoutMs);
      
      // 3. Gọi thành công: khôi phục trạng thái cầu dao (CLOSED)
      state.status = 'CLOSED';
      state.consecutiveFailures = 0;
      state.cooldownUntil = 0;

      return {
        content: resultText,
        requestedModel: key,
        actualMappedName: state.name,
        provider: key.includes('groq') ? 'groq' : 'google'
      };

    } catch (error) {
      handleModelError(state, error);
    } finally {
      // 4. Luôn nhả khóa bất kể thành công hay thất bại để tránh Deadlock
      state.isProbing = false;
    }
  }
  
  throw new Error("Tất cả các dịch vụ AI dự phòng đều thất bại hoặc đang trong thời gian giãn cách.");
};

/**
 * Sinh gợi ý Socratic cho câu hỏi học sinh làm sai
 * @param {string} questionContent - Nội dung câu hỏi gốc
 * @param {string} wrongAnswer - Đáp án học sinh chọn sai
 * @param {string} correctAnswer - Đáp án đúng của câu hỏi
 * @returns {Promise<string>} Gợi ý tư duy ngắn gọn
 */
export const generateSocraticHint = async (questionContent, wrongAnswer, correctAnswer) => {
  if (!isAiAvailable()) {
    return `Gợi ý gợi mở (Socratic): Hãy xem lại bước tính đạo hàm y' hoặc các phương thức rút gọn cơ bản liên quan đến ${correctAnswer} nhé.`;
  }
  try {
    const prompt = `Bạn là một gia sư toán học Socratic thân thiện. Học sinh đang làm câu hỏi sau:
"${questionContent}"
Đáp án đúng là: ${correctAnswer}
Nhưng học sinh chọn đáp án sai là: ${wrongAnswer}

Hãy tạo ra một gợi ý ngắn gọn (không quá 2-3 câu), định hướng tư duy (Socratic hint) giúp học sinh tự nhận ra lỗi sai hoặc tìm ra hướng đi đúng. KHÔNG được cho biết trực tiếp đáp án đúng hoặc đưa ra lời giải chi tiết trực diện. Gợi ý bằng tiếng Việt.`;
    
    const response = await generateContentWithFallback(prompt, 15000); // Quick hint: 15s timeout
    return response.content;
  } catch (error) {
    console.error("Lỗi khi sinh gợi ý Socratic:", error.message);
    return "Hãy đọc kỹ đề bài và tính toán cẩn thận từng bước giải.";
  }
};

/**
 * Phân tích kết quả bài làm (TestAttempt) và đưa ra đánh giá, định hướng ôn tập cho học sinh
 * @param {string} attemptId - ID của bản ghi làm bài thi
 * @returns {Promise<object>} Đối tượng chứa đánh giá tổng quan và lời khuyên ôn tập
 */
export const analyzeAttempt = async (attemptId, onProgress) => {
  const report = (step, msg) => {
    if (onProgress) onProgress(step, msg);
  };
  try {
    report('fetch_attempt', 'Đang tải dữ liệu kết quả bài làm từ cơ sở dữ liệu...');
    const attempt = await TestAttempt.findById(attemptId)
      .populate('user_id')
      .populate('exam_id')
      .populate('details.question_id');
      
    if (!attempt) return null;

    if (!isAiAvailable()) {
      console.log("Mô phỏng AI phân tích kết quả bài làm cho attempt:", attemptId);
      report('call_ai', 'Đang tạo báo cáo học lực mô phỏng (Chế độ không có AI)...');
      return {
        ai_evaluation: "Đánh giá (Mô phỏng): Bạn đang có kết quả tốt ở chủ đề đạo hàm cực trị, tuy nhiên phần tính tích phân cơ bản còn yếu (tỉ lệ đúng thấp). Lỗi phổ biến là nhầm lẫn các công thức nguyên hàm.",
        socratic_tutoring: "Lời khuyên: Hãy xem lại bảng nguyên hàm cơ bản và thực hành 5 bài tập mức độ dễ của phần Tích phân để lấy lại căn bản."
      };
    }

    report('prepare_prompt', 'Đang phân tích các câu làm sai và lập hồ sơ năng lực...');
    const wrongAnswers = attempt.details.filter(d => !d.is_correct);
    if (wrongAnswers.length === 0) {
      return {
        ai_evaluation: "Đánh giá xuất sắc! Bạn đã trả lời đúng hoàn toàn tất cả câu hỏi trong bài làm thi thử này.",
        socratic_tutoring: "Định hướng: Hãy bắt đầu thử sức với các bài thi thích ứng mức độ khó cao hơn (Ví dụ: đề thích ứng có difficulty_score từ 7 trở lên) để nâng cao giới hạn bản thân."
      };
    }

    // Tóm tắt các câu làm sai gửi lên AI phân tích
    const wrongAnswersSummary = wrongAnswers.map((wa, idx) => {
      const q = wa.question_id;
      // Trích xuất distractor analysis nếu có
      let distractorText = 'Không có phân tích từ hệ thống.';
      if (q.ai_analysis && q.ai_analysis.distractor_analysis) {
        // Map trong Mongoose lấy qua .get()
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

    report('call_ai', 'Đang gửi yêu cầu phân tích học lực tới mô hình AI (có thể mất 5 giây)...');
    const response = await generateContentWithFallback(prompt, 30000); // 30s timeout cho phân tích bài làm
    const responseText = response.content;

    report('parse_response', 'Đang định dạng lại báo cáo học lực và lời khuyên Socratic...');
    // Tách văn bản phản hồi của AI thành Đánh giá chung và Lời khuyên ôn tập
    const parts = responseText.split(/2\.\s*\"?Định hướng/i);
    const evaluation = parts[0].replace(/1\.\s*\"?Đánh giá[^\n]*/i, '').trim();
    const tutoring = parts[1] ? parts[1].trim() : "Hãy tiếp tục xem lại các kiến thức cơ bản nhé.";

    return {
      ai_evaluation: evaluation,
      socratic_tutoring: tutoring
    };
  } catch (error) {
    console.error("Lỗi khi phân tích bài làm:", error.message);
    return null;
  }
};

// Helper to escape literal control characters and unescaped backslashes inside JSON string values
const sanitizeJsonString = (str) => {
  let insideQuote = false;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '"') {
      let isEscaped = false;
      let k = i - 1;
      while (k >= 0 && str[k] === '\\') {
        isEscaped = !isEscaped;
        k--;
      }
      if (!isEscaped) {
        insideQuote = !insideQuote;
      }
    }
    
    if (insideQuote && char === '\\') {
      const nextChar = str[i + 1];
      if (nextChar === '\\') {
        result += '\\\\';
        i++; // skip next backslash
      } else if (nextChar === '"') {
        result += '\\"';
        i++; // skip next quote
      } else {
        result += '\\\\';
      }
    } else if (insideQuote && (char === '\n' || char === '\r')) {
      result += '\\n';
    } else if (insideQuote && char === '\t') {
      result += '\\t';
    } else {
      result += char;
    }
  }
  return result;
};

// Hàm sửa lỗi và khôi phục mảng JSON bị cắt cụt do chạm giới hạn token
const tryRepairJsonArray = (text) => {
  let cleaned = text.trim();
  if (!cleaned.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    let lastBraceIdx = cleaned.lastIndexOf('}');
    while (lastBraceIdx > 0) {
      const candidate = cleaned.substring(0, lastBraceIdx + 1) + '\n]';
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`=== [AI Recovery] Đã tự động khôi phục và sửa lỗi JSON bị cắt cụt! Phục hồi được ${parsed.length} câu hỏi. ===`);
          return parsed;
        }
      } catch (err) {
        // Tiếp tục lùi lại tìm dấu đóng ngoặc trước đó
      }
      cleaned = cleaned.substring(0, lastBraceIdx);
      lastBraceIdx = cleaned.lastIndexOf('}');
    }
  }
  return null;
};

export const generateExamWithGemini = async (title, topicId, difficulty, numQuestions, documentId, onProgress) => {
  const report = (step, msg) => {
    if (onProgress) onProgress(step, msg);
  };
  try {
    let generatedQuestions = [];
    report('load_docs', 'Đang tải tài liệu ôn tập và ngữ cảnh tham chiếu...');
    
    // Tính toán phân bổ độ khó động
    let difficultyScores = [];
    const N = numQuestions;
    if (difficulty === 'random') {
      let numNB = 0, numTH = 0, numVD = 0, numVDC = 0;
      if (N === 1) numNB = 1;
      else if (N === 2) { numNB = 1; numTH = 1; }
      else if (N === 3) { numNB = 1; numTH = 1; numVD = 1; }
      else {
        numNB = Math.floor(N * 0.4);
        numTH = Math.floor(N * 0.3);
        numVD = Math.floor(N * 0.2);
        numVDC = N - (numNB + numTH + numVD);
      }
      for (let i = 0; i < numNB; i++) difficultyScores.push(2);
      for (let i = 0; i < numTH; i++) difficultyScores.push(5);
      for (let i = 0; i < numVD; i++) difficultyScores.push(7.5);
      for (let i = 0; i < numVDC; i++) difficultyScores.push(9.5);
    } else {
      const parsedDiff = parseInt(difficulty) || 5;
      for (let i = 0; i < numQuestions; i++) difficultyScores.push(parsedDiff);
    }

    // Lấy tài liệu ngữ cảnh theo yêu cầu (Hỗ trợ đa tài liệu hoạt động đồng thời)
    let refDocs = [];
    if (documentId === 'default') {
      refDocs = [];
    } else if (documentId && documentId !== 'active') {
      const singleDoc = await ReferenceDoc.findById(documentId);
      if (singleDoc) refDocs.push(singleDoc);
    } else {
      // Tự động lọc tài liệu hoạt động phù hợp: cùng chủ đề thi HOẶC đề thi thử tổng hợp (general_exam)
      refDocs = await ReferenceDoc.find({
        isActive: true,
        $or: [
          { doc_type: 'general_exam' },
          { doc_type: 'topic', topic_id: topicId }
        ]
      });
    }

    let refContext = '';
    if (refDocs.length > 0) {
      const mergedText = refDocs.map(d => {
        const docText = d.extracted_text || '';
        // Giới hạn độ dài văn bản của mỗi tài liệu gửi lên AI để tránh lỗi vượt quá giới hạn token (TPM) của các dịch vụ AI dự phòng như Groq Llama
        const maxChars = 8000;
        const truncatedText = truncateAtSafeBoundary(docText, maxChars);
        return `[Tài liệu: ${d.title}]\n${truncatedText}`;
      }).join('\n\n---\n\n');
      refContext = `\n[TÀI LIỆU THAM KHẢO CHUYÊN MÔN CỦA GIÁO VIÊN]:\n${mergedText}\n(Hãy ưu tiên biên soạn câu hỏi bám sát kiến thức, công thức, định lý, hoặc bài toán mẫu có trong tài liệu tham khảo trên nếu chúng phù hợp với chủ đề thi).\n`;
    }

    if (!isAiAvailable()) {
      console.log("Mô phỏng Gemini sinh đề thi cho chủ đề:", topicId, "Có tài liệu tham khảo:", refDocs.length > 0);
      report('call_ai', 'Đang tạo câu hỏi mô phỏng (Chế độ không có AI)...');
      generatedQuestions = [
        {
          content: `[Mô phỏng] Cho hàm số thuộc chủ đề ${topicId}.${refDocs.length > 0 ? ' (Sinh bám sát tài liệu)' : ''}`,
          options: { "A": "1", "B": "2", "C": "3", "D": "4" },
          correct_answer: "A",
          ai_analysis: {
            distractor_analysis: {
              "B": "Nhầm công thức đạo hàm.",
              "C": "Sai cận tích phân.",
              "D": "Không đổi dấu cực trị."
            },
            socratic_hint: "Cần xem lại định nghĩa.",
            solution_steps: "Tính toán chi tiết từng bước."
          }
        },
        {
          content: `[Mô phỏng] Tính tích phân cơ bản liên quan đến chủ đề ${topicId}.${refDocs.length > 0 ? ' (Sinh bám sát tài liệu)' : ''}`,
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
      report('prepare_prompt', 'Đang xây dựng prompt chuẩn hóa độ khó toán học...');
      // Xây dựng danh sách yêu cầu độ khó chi tiết cho từng câu hỏi ở vị trí tương ứng
      let difficultyInstruction = '';
      let targetLevels = [];
      
      if (difficulty === 'random') {
        let numNB = 0, numTH = 0, numVD = 0, numVDC = 0;
        if (N === 1) numNB = 1;
        else if (N === 2) { numNB = 1; numTH = 1; }
        else if (N === 3) { numNB = 1; numTH = 1; numVD = 1; }
        else {
          numNB = Math.floor(N * 0.4);
          numTH = Math.floor(N * 0.3);
          numVD = Math.floor(N * 0.2);
          numVDC = N - (numNB + numTH + numVD);
        }
        for (let i = 0; i < numNB; i++) targetLevels.push('Nhận biết');
        for (let i = 0; i < numTH; i++) targetLevels.push('Thông hiểu');
        for (let i = 0; i < numVD; i++) targetLevels.push('Vận dụng');
        for (let i = 0; i < numVDC; i++) targetLevels.push('Vận dụng cao');
      } else {
        const parsedDiff = parseInt(difficulty) || 5;
        let level = 'Thông hiểu';
        if (parsedDiff <= 3) level = 'Nhận biết';
        else if (parsedDiff <= 6) level = 'Thông hiểu';
        else if (parsedDiff <= 8) level = 'Vận dụng';
        else level = 'Vận dụng cao';
        for (let i = 0; i < numQuestions; i++) targetLevels.push(level);
      }

      const levelRequirements = targetLevels.map((lvl, idx) => {
        let criteria = '';
        if (lvl === 'Nhận biết') {
          criteria = 'Mức độ Nhận biết (1-3/10). Câu hỏi lý thuyết trực quan, công thức cơ bản hoặc đọc trực tiếp từ bảng biến thiên/đồ thị cho sẵn mà không cần biến đổi phức tạp. Ví dụ: Cho hàm số f(x) có bảng biến thiên... Hỏi hàm số đạt cực đại tại điểm nào?';
        } else if (lvl === 'Thông hiểu') {
          criteria = 'Mức độ Thông hiểu (4-6/10). Đòi hỏi áp dụng định lý hoặc công thức cơ bản để giải qua 1-2 bước tính toán cơ bản (ví dụ: tính đạo hàm bậc nhất của y = x^3 - 3x^2 + 2 rồi giải phương trình y\' = 0 để tìm điểm cực tiểu).';
        } else if (lvl === 'Vận dụng') {
          criteria = 'Mức độ Vận dụng (7-8/10). Đòi hỏi tính toán kết hợp nhiều bước, biến đổi đại số hoặc biện luận tham số m ở mức trung bình (ví dụ: tìm tất cả các giá trị của m để hàm số y = x^3 - 3mx^2 + 3(m^2-1)x đạt cực đại tại x = 1).';
        } else {
          criteria = 'Mức độ Vận dụng cao (9-10/10). Bài toán phân hóa học sinh cực kỳ sâu sắc. Yêu cầu tư duy logic cao, hàm hợp nhiều lớp chứa trị tuyệt đối hoặc chứa tham số m phức tạp dạng g(x) = |f(u(x)) + m| hoặc g(x) = f(x^3 - 3x^2 + m) có bao nhiêu điểm cực trị, đòi hỏi lập luận tương giao đồ thị và bảng biến thiên của hàm số.';
        }
        return `- **Câu hỏi số ${idx + 1}**: Mức độ **${lvl}** (${criteria})`;
      }).join('\n');

      difficultyInstruction = `Hãy sinh một danh sách gồm chính xác ${numQuestions} câu hỏi trắc nghiệm Toán học lớp 12 thuộc chủ đề "${topicId}" được phân bổ chính xác theo các mức độ khó sau:\n${levelRequirements}`;

      const prompt = `Bạn là chuyên gia hàng đầu về ra đề thi Toán THPT Quốc gia tại Việt Nam. ${refContext}
${difficultyInstruction}

MẪU VÍ DỤ PHÂN HÓA ĐỘ KHÓ (HÃY BÁM SÁT ĐỘ PHỨC TẠP TOÁN HỌC NÀY):
1. **Ví dụ Nhận biết (Dễ)**:
   - Đề bài: "Cho hàm số $y=f(x)$ liên tục trên $\\mathbb{R}$ và có bảng biến thiên của đạo hàm $f'(x)$ như sau... Hỏi hàm số đạt cực đại tại điểm nào?"
   - Yêu cầu: Đơn giản, học sinh chỉ cần nhìn bảng biến thiên để tìm điểm cực trị của x.
2. **Ví dụ Thông hiểu (Trung bình)**:
   - Đề bài: "Tìm điểm cực tiểu của hàm số $y = x^3 - 3x^2 + 5$."
   - Yêu cầu: Tính đạo hàm $y' = 3x^2 - 6x$, giải $y'=0 \\Leftrightarrow x=0, x=2$, xét dấu chọn $x=2$.
3. **Ví dụ Vận dụng (Khó vừa)**:
   - Đề bài: "Tìm tất cả các giá trị thực của tham số $m$ để hàm số $y = \\frac{1}{3}x^3 - mx^2 + (m^2 - m + 1)x + 1$ đạt cực đại tại điểm $x = 1$."
   - Yêu cầu: Tính $y'$, thiết lập điều kiện cần $y'(1)=0$ giải tìm $m$, sau đó dùng đạo hàm cấp 2 $y''(1) < 0$ để kiểm tra điều kiện đủ.
4. **Ví dụ Vận dụng cao (Khó hẳn - Phân hóa cực sâu)**:
   - Đề bài: "Cho hàm số đa thức bậc bốn $y=f(x)$ có đạo hàm $f'(x)$ có đồ thị cắt trục hoành tại ba điểm phân biệt $x=-3$, $x=-1$, $x=1$. Có bao nhiêu giá trị nguyên của tham số $m$ để hàm số $g(x) = f(|x^2-2x| + m)$ có đúng 7 điểm cực trị?"
   - Yêu cầu: Phân tích đạo hàm hàm hợp, lập bảng biến thiên của $u(x) = |x^2-2x|$, biện luận tương giao đồ thị để tìm các giá trị nguyên của $m$ thỏa mãn điều kiện có 7 điểm cực trị. Câu hỏi này đòi hỏi tư duy cực kỳ sâu sắc và nhiều bước suy luận toán học phức tạp.

Yêu cầu định dạng toán học:
- TẤT CẢ các công thức toán học trong câu hỏi và các lựa chọn đáp án PHẢI được bọc trong ký hiệu LaTeX dạng inline (ví dụ: $y = x^2$) hoặc block (ví dụ: $$y = x^2$$) để hiển thị chính xác.
- KHÔNG sử dụng các ký tự toán học Unicode trần trụi (ví dụ: dùng $x \\in \\mathbb{R}$ thay vì x thuộc R).

HƯỚNG DẪN ĐẶC BIỆT CHO CHỦ ĐỀ CỰC TRỊ / ĐẠO HÀM:
Nếu chủ đề là "cuc_tri_ham_so" hoặc liên quan đến đạo hàm, và độ khó là Vận dụng hoặc Vận dụng cao:
1. Hãy sinh các bài toán vận dụng cao như tìm số điểm cực trị của hàm hợp $g(x) = f(u(x))$, hàm trị tuyệt đối $g(x) = |f(x) + m|$, hoặc các hàm liên kết dạng $g(x) = a \\cdot f(x) + b$ dựa trên bảng biến thiên (BBT) hoặc đồ thị của hàm số $f(x)$ hoặc đạo hàm $f'(x)$.
2. Vẽ bảng biến thiên bằng cấu trúc LaTeX \`\\begin{array}\` đẹp mắt và hợp lệ. Đảm bảo sử dụng ký hiệu xuống dòng trong LaTeX là \`\\\\\` (khi viết trong JSON phải ghi là \`\\\\\\\\\` để tránh bị lỗi escape).

Ví dụ vẽ bảng biến thiên của đạo hàm $f'(x)$ trong JSON:
"content": "Cho hàm số $y=f(x)$ có bảng biến thiên của đạo hàm $f'(x)$ như sau: \\n\\n $$ \\\\begin{array}{c|ccccccc} x & -\\\\infty & & -4 & & 0 & & 1 & & +\\\\infty \\\\\\\\ \\\\hline & +\\\\infty & & & & 3 & & & & +\\\\infty \\\\\\\\ f'(x) & & \\\\searrow & & \\\\nearrow & & \\\\searrow & & \\\\nearrow & \\\\\\\\ & & & -4 & & & & -2 & & \\\\end{array} $$ \\n\\nHỏi hàm số..."

Hãy chú ý: Trong chuỗi JSON, ký hiệu xuống dòng của LaTeX là hai dấu gạch chéo ngược \`\\\\\`, vì thế trong chuỗi JSON thô bạn phải viết là \`\\\\\\\\\` (4 dấu gạch chéo ngược) để khi hệ thống parse ra sẽ nhận được \`\\\\\` chính xác cho KaTeX render. Tuyệt đối không dùng ký tự xuống dòng \`\\n\` để thay thế cho ký hiệu xuống dòng \`\\\\\` của LaTeX.

Yêu cầu kết quả trả về:
BẮT BUỘC phải là một mảng JSON thuần túy, không có ký tự bao quanh như \`\`\`json hay bất kỳ dòng giải thích nào khác ngoài chuỗi JSON. 
Lưu ý quan trọng khi định dạng JSON: Vì kết quả trả về ở dạng JSON, hãy đảm bảo escape đúng các dấu gạch chéo ngược (dùng \\\\ thay vì \\ trong chuỗi JSON, ví dụ: \\\\searrow, \\\\begin{array}, \\\\infty).

Cấu trúc mỗi phần tử câu hỏi trong mảng như sau:
[
  {
    "content": "Nội dung câu hỏi (chứa đề bài và bảng biến thiên nếu có)...",
    "difficulty": "Nhận biết hoặc Thông hiểu hoặc Vận dụng hoặc Vận dụng cao",
    "options": {
      "A": "Lựa chọn A...",
      "B": "Lựa chọn B...",
      "C": "Lựa chọn C...",
      "D": "Lựa chọn D..."
    },
    "correct_answer": "A hoặc B hoặc C hoặc D",
    "ai_analysis": {
      "distractor_analysis": {
        "chữ_cái_đáp_án_sai_1": "Lý giải tại sao học sinh chọn đáp án sai này...",
        "chữ_cái_đáp_án_sai_2": "Lý giải tại sao học sinh chọn đáp án sai này...",
        "chữ_cái_đáp_án_sai_3": "Lý giải tại sao học sinh chọn đáp án sai này..."
      },
      "socratic_hint": "Gợi ý định hướng tư duy Socratic ngắn gọn...",
      "solution_steps": "Lời giải chi tiết từng bước..."
    }
  }
]`;

      report('call_ai', 'Đang gửi yêu cầu biên soạn câu hỏi tới mô hình AI (có thể mất 5-15 giây)...');
      const response = await generateContentWithFallback(prompt, 45000, true); // 45s timeout cho sinh đề thi nặng (sử dụng JSON Mode)
      const rawText = response.content;
      
      report('parse_json', 'Đang tiếp nhận và phân tích cú pháp dữ liệu câu hỏi từ AI...');
      // Loại bỏ định dạng block code nếu AI trả về nhầm
      const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const sanitizedText = sanitizeJsonString(cleanJsonText);
      try {
        generatedQuestions = JSON.parse(sanitizedText);
      } catch (parseErr) {
        console.warn("JSON.parse đề thi thất bại, cố gắng tự động sửa chuỗi JSON bị đứt gãy...");
        const repaired = tryRepairJsonArray(sanitizedText);
        if (repaired) {
          generatedQuestions = repaired;
        } else {
          throw parseErr;
        }
      }

      // Chuẩn hóa kết quả trả về luôn là một mảng
      if (generatedQuestions && !Array.isArray(generatedQuestions)) {
        if (Array.isArray(generatedQuestions.questions)) {
          generatedQuestions = generatedQuestions.questions;
        } else if (Array.isArray(generatedQuestions.exam)) {
          generatedQuestions = generatedQuestions.exam;
        } else if (typeof generatedQuestions === 'object') {
          const keys = Object.keys(generatedQuestions);
          const arrayKey = keys.find(k => Array.isArray(generatedQuestions[k]));
          if (arrayKey) {
            generatedQuestions = generatedQuestions[arrayKey];
          } else {
            generatedQuestions = [generatedQuestions];
          }
        } else {
          generatedQuestions = [];
        }
      }
    }

    // 2. Lưu các câu hỏi mới vào collection questions
    report('save_questions', 'Đang lưu các câu hỏi mới, lời giải chi tiết và gợi ý Socratic vào cơ sở dữ liệu...');
    const questionDocs = generatedQuestions.map((q, idx) => {
      let score = difficultyScores[idx] || 5;
      // Ánh xạ lại điểm số dựa trên phân loại độ khó thực tế của AI nếu có
      if (q.difficulty) {
        const diffStr = q.difficulty.trim();
        if (diffStr.includes('Nhận biết')) score = 2;
        else if (diffStr.includes('Thông hiểu')) score = 5;
        else if (diffStr.includes('Vận dụng cao')) score = 9.5;
        else if (diffStr.includes('Vận dụng')) score = 7.5;
      }

      return {
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        metadata: {
          topic: topicId,
          sub_topic: topicId + '_tu_dong',
          difficulty_score: score,
          source: 'AI_Gemini'
        },
        ai_analysis: q.ai_analysis,
        embedding: [0.0, 0.0, 0.0]
      };
    });

    const savedQuestions = await Question.insertMany(questionDocs);
    const questionIds = savedQuestions.map(q => q._id);

    // 3. Khởi tạo đề thi mới liên kết các câu hỏi trên
    report('save_exam', 'Đang khởi tạo cấu trúc đề thi thích ứng và thiết lập cài đặt an toàn...');
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
    report('complete', 'Hoàn tất biên soạn đề thi thành công!');
    return await Exam.findById(exam._id).populate('questions');
  } catch (error) {
    console.error("Lỗi khi sinh đề thi bằng Gemini:", error.message);
    throw error;
  }
};

export const cloneQuestionWithGemini = async (originalQuestion) => {
  try {
    if (!isAiAvailable()) {
      // Fallback mô phỏng nếu không có AI
      const mockCloned = new Question({
        content: `[Tương tự] ${originalQuestion.content} (Đã đổi số)`,
        options: originalQuestion.options,
        correct_answer: originalQuestion.correct_answer,
        metadata: {
          topic: originalQuestion.metadata.topic,
          sub_topic: originalQuestion.metadata.sub_topic,
          difficulty_score: originalQuestion.metadata.difficulty_score,
          source: 'AI_Gemini_Clone'
        },
        ai_analysis: originalQuestion.ai_analysis
      });
      await mockCloned.save();
      return mockCloned;
    }

    const prompt = `Bạn là chuyên gia hàng đầu về ra đề thi Toán THPT Quốc gia tại Việt Nam.
Dưới đây là một câu hỏi trắc nghiệm Toán học lớp 12:
- Đề bài: ${originalQuestion.content}
- Lựa chọn:
  A: ${originalQuestion.options.A}
  B: ${originalQuestion.options.B}
  C: ${originalQuestion.options.C}
  D: ${originalQuestion.options.D}
- Đáp án đúng: ${originalQuestion.correct_answer}

Yêu cầu:
1. Hãy tạo một câu hỏi TƯƠNG TỰ câu hỏi trên bằng cách thay đổi số liệu, biến số hoặc phép tính một cách tương đương, sao cho kiến thức kiểm tra, cấu trúc toán học và độ khó giữ nguyên tuyệt đối không đổi.
2. Bảo toàn định dạng LaTeX toán học (đặt trong các dấu $ hoặc $$).
3. Đảm bảo đáp án đúng tương ứng và viết phân tích đáp án gây nhiễu (distractor analysis) tương ứng với số liệu mới.

Kết quả trả về Bắt buộc phải là một đối tượng JSON duy nhất (không bọc trong \`\`\`json), có định dạng chính xác sau:
{
  "content": "Nội dung câu hỏi mới...",
  "options": {
    "A": "Đáp án A mới...",
    "B": "Đáp án B mới...",
    "C": "Đáp án C mới...",
    "D": "Đáp án D mới..."
  },
  "correct_answer": "A hoặc B hoặc C hoặc D",
  "ai_analysis": {
    "distractor_analysis": {
      "A": "Phân tích đáp án A...",
      "B": "Phân tích đáp án B...",
      "C": "Phân tích đáp án C...",
      "D": "Phân tích đáp án D..."
    },
    "socratic_hint": "Gợi ý socratic ngắn...",
    "solution_steps": "Lời giải chi tiết từng bước..."
  }
}`;

    const response = await generateContentWithFallback(prompt, 25000, true); // 25s timeout cho nhân bản câu hỏi thích ứng (sử dụng JSON Mode)
    const rawText = response.content;
    const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const sanitizedText = sanitizeJsonString(cleanJsonText);
    const qData = JSON.parse(sanitizedText);

    const clonedDoc = new Question({
      content: qData.content,
      options: qData.options,
      correct_answer: qData.correct_answer,
      metadata: {
        topic: originalQuestion.metadata.topic,
        sub_topic: originalQuestion.metadata.sub_topic,
        difficulty_score: originalQuestion.metadata.difficulty_score,
        source: 'AI_Gemini_Clone'
      },
      ai_analysis: qData.ai_analysis
    });

    await clonedDoc.save();
    return clonedDoc;
  } catch (error) {
    console.error("Lỗi khi clone câu hỏi bằng Gemini:", error.message);
    // Trả về câu hỏi gốc nếu clone lỗi để đảm bảo tính liên tục của hệ thống
    return originalQuestion;
  }
};

export const analyzeTopicsWithGemini = async (combinedText) => {
  try {
    if (!isAiAvailable()) {
      console.log("=== AI chưa được kích hoạt, sử dụng danh sách chủ đề mẫu ===");
      return [
        { name: 'Đạo hàm cấp cao', topic_id: 'dao_ham_cap_cao', chapter: 'Ứng dụng đạo hàm', grade: 12 },
        { name: 'Tích phân từng phần', topic_id: 'tich_phan_tung_phan', chapter: 'Nguyên hàm - Tích phân', grade: 12 },
        { name: 'Phương trình mặt cầu', topic_id: 'phuong_trinh_mat_cau', chapter: 'Phương pháp tọa độ Oxyz', grade: 12 }
      ];
    }

    const prompt = `Bạn là chuyên gia cấu trúc chương trình Toán học THPT tại Việt Nam. Hãy đọc và phân tích đoạn văn bản được trích xuất từ các tài liệu PDF sau đây:

--- NỘI DUNG TÀI LIỆU ---
${truncateAtSafeBoundary(combinedText, 15000)}

--- YÊU CẦU ---
Hãy phân tích nội dung trên để trích xuất ra một danh sách gồm các chủ đề/dạng toán toán học cụ thể được nhắc đến hoặc có bài tập hướng dẫn trong tài liệu. 
Mỗi chủ đề trong danh sách phải gồm đầy đủ các thông tin:
- name: Tên chủ đề ngắn gọn bằng tiếng Việt (Ví dụ: "Cực trị của hàm số", "Tích phân từng phần").
- topic_id: Mã định danh viết liền không dấu, dùng snake_case (Ví dụ: "cuc_tri_ham_so", "tich_phan_tung_phan", "phuong_trinh_mat_cau").
- chapter: Tên chương học chứa chủ đề đó (Ví dụ: "Ứng dụng đạo hàm", "Nguyên hàm - Tích phân", "Phương pháp tọa độ Oxyz").
- grade: Khối lớp (phải là số nguyên: 10, 11 hoặc 12).

Kết quả trả về BẮT BUỘC phải là một mảng JSON thuần túy, không có ký tự bao quanh như \`\`\`json hay bất kỳ dòng giải thích nào khác ngoài chuỗi JSON. Ví dụ mẫu kết quả mong muốn:
[
  { "name": "Cực trị của hàm số", "topic_id": "cuc_tri_ham_so", "chapter": "Ứng dụng đạo hàm", "grade": 12 }
]`;

    const response = await generateContentWithFallback(prompt, 35000, true); // 35s timeout cho quét chủ đề phức tạp (sử dụng JSON Mode)
    const rawText = response.content;
    const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const sanitizedText = sanitizeJsonString(cleanJsonText);
    let parsedTopics;
    try {
      parsedTopics = JSON.parse(sanitizedText);
    } catch (parseErr) {
      console.warn("JSON.parse chủ đề thất bại, cố gắng tự động sửa chuỗi JSON bị đứt gãy...");
      const repaired = tryRepairJsonArray(sanitizedText);
      if (repaired) {
        parsedTopics = repaired;
      } else {
        throw parseErr;
      }
    }

    // Chuẩn hóa kết quả trả về luôn là một mảng
    if (parsedTopics && !Array.isArray(parsedTopics)) {
      if (Array.isArray(parsedTopics.topics)) {
        parsedTopics = parsedTopics.topics;
      } else if (typeof parsedTopics === 'object') {
        const keys = Object.keys(parsedTopics);
        const arrayKey = keys.find(k => Array.isArray(parsedTopics[k]));
        if (arrayKey) {
          parsedTopics = parsedTopics[arrayKey];
        } else {
          parsedTopics = [parsedTopics];
        }
      } else {
        parsedTopics = [];
      }
    }
    return parsedTopics;
  } catch (error) {
    console.error("Lỗi khi phân tích chủ đề bằng Gemini:", error.message);
    throw error;
  }
};

export const getKnowledgeSummaryFromGemini = async (topicId, topicName) => {
  try {
    if (!isAiAvailable()) {
      console.log("=== AI chưa được kích hoạt, sử dụng tóm tắt kiến thức mẫu ===");
      return `# TỔNG HỢP KIẾN THỨC: ${topicName.toUpperCase()}

## I. Lý thuyết & Định nghĩa cốt lõi
- Hàm số $y = f(x)$ liên tục trên khoảng $K$ và có đạo hàm $f'(x)$ trên $K$.
- Điểm cực trị là điểm mà tại đó đạo hàm $f'(x)$ đổi dấu khi đi qua nó.
- Nếu $f'(x)$ đổi dấu từ dương sang âm tại $x_0$, thì $x_0$ là điểm cực đại.
- Nếu $f'(x)$ đổi dấu từ âm sang dương tại $x_0$, thì $x_0$ là điểm cực tiểu.

## II. Các công thức toán học quan trọng
- Phương trình đạo hàm tìm cực trị:
  $$f'(x) = 0$$
- Phương trình tiếp tuyến tại điểm cực trị $(x_0, y_0)$:
  $$y = y_0$$

## III. Các dạng bài tập thường gặp & Phương pháp giải
### Dạng 1: Tìm cực trị dựa trên bảng biến thiên (BBT) hoặc đồ thị
- **Bước 1**: Nhìn dòng $f'(x)$ để tìm điểm đạo hàm bằng 0 hoặc không xác định.
- **Bước 2**: Xác định các khoảng đạo hàm đổi dấu.
- **Bước 3**: Kết luận điểm cực đại/cực tiểu.

### Dạng 2: Tìm tham số m để hàm số đạt cực trị tại một điểm
- **Phương pháp**: Sử dụng điều kiện cần và đủ:
  - Điều kiện cần: $f'(x_0) = 0$ để tìm các giá trị của $m$.
  - Điều kiện đủ: Kiểm tra lại dấu đạo hàm hoặc sử dụng đạo hàm cấp hai $f''(x_0) \\neq 0$ để loại giá trị $m$ sai.

## IV. Bài tập ví dụ minh họa điển hình
**Bài tập 1**: Cho hàm số $f(x)$ có đạo hàm $f'(x) = x(x-1)^2(x+2)$. Tìm số điểm cực trị của hàm số đã cho.
- *Lời giải*:
  - Cho $f'(x) = 0 \\Leftrightarrow x = 0$, $x = 1$ (nghiệm kép), $x = -2$.
  - Vì $x=1$ là nghiệm kép, đạo hàm không đổi dấu khi đi qua nó. Do đó hàm số chỉ đổi dấu khi qua $x=0$ và $x=-2$.
  - Kết luận: Hàm số có đúng 2 điểm cực trị.`;
    }

    const prompt = `Bạn là một giáo viên Toán THPT xuất sắc tại Việt Nam. Hãy biên soạn một tài liệu "Tổng hợp kiến thức & Lý thuyết cốt lõi" thật chi tiết và đầy đủ cho chủ đề toán học: "${topicName}" (Mã chủ đề: ${topicId}).

Tài liệu PHẢI được định dạng bằng Markdown đẹp mắt và bao gồm 4 phần chính sau:

# TỔNG HỢP KIẾN THỨC: ${topicName.toUpperCase()}

## I. Lý thuyết & Định nghĩa cốt lõi
- Giải thích chi tiết các khái niệm, định lý, điều kiện xác định, định nghĩa toán học liên quan đến chủ đề này một cách sư phạm, dễ hiểu đối với học sinh THPT Việt Nam.
- Các biểu thức toán học phải được định dạng bằng LaTeX (ví dụ: $y = f(x)$ hoặc $\\int f(x) dx$).

## II. Các công thức toán học quan trọng
- Liệt kê toàn bộ các công thức, phương trình, hệ thức cần ghi nhớ dưới dạng LaTeX block ($$...$$).

## III. Các dạng bài tập thường gặp & Phương pháp giải
- Chia thành ít nhất 2-3 dạng bài tập điển hình.
- Với mỗi dạng, ghi rõ các bước phương pháp giải chi tiết, thuật toán giải nhanh (nếu có).

## IV. Bài tập ví dụ minh họa điển hình
- Đưa ra ít nhất 2 bài tập ví dụ thực tế.
- Có hướng dẫn giải chi tiết từng bước, sử dụng ngôn ngữ Socratic định hướng tư duy để học sinh dễ tiếp thu.

**Lưu ý cực kỳ quan trọng**:
- TẤT CẢ các công thức toán học PHẢI sử dụng LaTeX (bọc bằng $ cho inline, hoặc $$ cho block).
- Đảm bảo viết tiếng Việt chuẩn xác, hành văn mạch lạc, học thuật nhưng dễ hiểu đối với học sinh trung bình khá trở lên.
- Trả về trực tiếp văn bản Markdown của tài liệu, không dùng các từ mở đầu/kết luận như "Dưới đây là..." hay "Hy vọng tài liệu này giúp ích...".`;

    const response = await generateContentWithFallback(prompt, 35000); // 35s timeout cho tổng hợp lý thuyết Wiki
    return response.content;
  } catch (error) {
    console.error("Lỗi khi tổng hợp kiến thức bằng Gemini:", error.message);
    throw error;
  }
};

/**
 * Trích xuất văn bản từ tệp PDF bằng cách gửi trực tiếp dữ liệu dạng inline tới Gemini (Multimodal).
 * Hữu ích cho các tệp PDF dạng ảnh quét (scanned PDF) hoặc tài liệu toán học chứa nhiều ký hiệu phức tạp.
 * Có tích hợp Fallback, Timeout và Circuit Breaker bảo vệ.
 * 
 * @param {Buffer} pdfBuffer - Buffer dữ liệu tệp PDF
 * @param {number} timeoutMs - Thời gian timeout cho mỗi yêu cầu gọi model
 * @returns {Promise<string>} Nội dung văn bản/cấu trúc đề thi trích xuất dưới dạng Markdown
 */
export const extractTextFromPdfWithGemini = async (pdfBuffer, timeoutMs = 60000) => {
  await initPromise;
  
  // Chỉ lọc các mô hình của Google (Gemini) hỗ trợ đầu vào PDF
  const geminiKeys = Object.keys(modelStates).filter(key => !key.startsWith('groq'));
  
  for (const key of geminiKeys) {
    const state = modelStates[key];
    
    // 1. Kiểm tra trạng thái cầu dao OPEN
    if (state.status === 'OPEN') {
      if (Date.now() < state.cooldownUntil) {
        continue; // Đang trong thời gian khóa cooldown -> Bỏ qua
      }
      
      if (state.isProbing) {
        continue; // Tránh Thundering Herd: Request khác đang probe rồi -> Bỏ qua
      }
      
      state.isProbing = true;
      console.log(`[Circuit Breaker] Thử nghiệm lại mô hình ${state.name} cho PDF OCR (HALF_OPEN)...`);
    }

    try {
      if (!state.instance) {
        throw new Error(`Google model instance for ${key} not initialized`);
      }
      
      console.log(`[AI Service] Đang gửi tài liệu PDF trực tiếp sang ${state.name} để OCR/trích xuất văn bản...`);
      const prompt = "Bạn là chuyên gia số hóa đề thi toán học THPT. Hãy trích xuất toàn bộ nội dung văn bản, các câu hỏi và các lựa chọn đáp án trong tài liệu PDF này dưới dạng Markdown. Đối với tất cả công thức toán học, bảng biến thiên, phương trình, hãy chuyển sang định dạng LaTeX chuẩn (bọc trong ký hiệu $ cho inline và $$ cho block). Giữ nguyên cấu trúc đề thi chính xác.";

      const resultText = await withTimeout(async (signal) => {
        const result = await state.instance.generateContent([
          {
            inlineData: {
              data: pdfBuffer.toString("base64"),
              mimeType: "application/pdf"
            }
          },
          prompt
        ], { signal });
        return result.response.text().trim();
      }, timeoutMs);

      // Gọi thành công: khôi phục trạng thái cầu dao
      state.status = 'CLOSED';
      state.consecutiveFailures = 0;
      state.cooldownUntil = 0;
      return resultText;

    } catch (error) {
      handleModelError(state, error);
    } finally {
      state.isProbing = false;
    }
  }
  
  throw new Error("Tất cả các dịch vụ Gemini hỗ trợ trích xuất PDF đều thất bại hoặc đang trong thời gian giãn cách.");
};
