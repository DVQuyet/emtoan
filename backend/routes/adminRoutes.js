import express from 'express';
import multer from 'multer';
import ReferenceDoc from '../models/ReferenceDoc.js';
import { PDFParse } from 'pdf-parse';
import { analyzeTopicsWithGemini } from '../services/aiService.js';
import Topic from '../models/Topic.js';

const router = express.Router();

// Cấu hình multer lưu vào bộ nhớ đệm (buffer) để parse trực tiếp không cần ghi đĩa
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn tệp 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận tệp định dạng PDF.'), false);
    }
  }
});

// POST /api/admin/upload-reference - Tải lên và phân tích PDF tài liệu tham khảo
router.post('/upload-reference', upload.single('pdf'), async (req, res) => {
  const isStream = req.query.stream === 'true';

  if (!isStream) {
    try {
      if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn tệp PDF để tải lên.' });
      console.log(`Đang trích xuất văn bản từ tệp PDF: ${req.file.originalname} (${req.file.size} bytes)...`);
      
      let extractedText = '';
      let isOcrFallback = false;
      
      try {
        const p = new PDFParse({ data: req.file.buffer });
        const pdfData = await p.getText();
        extractedText = pdfData.text.trim();
      } catch (parseError) {
        console.warn("Lỗi trích xuất bằng pdf-parse:", parseError.message);
      }

      const pageNumPattern = /^\s*(--\s*\d+\s*of\s*\d+\s*--\s*)*\s*$/;
      const isScannedOrShort = !extractedText || extractedText.length < 300 || pageNumPattern.test(extractedText);

      if (isScannedOrShort) {
        try {
          const { extractTextFromPdfWithGemini } = await import('../services/aiService.js');
          extractedText = await extractTextFromPdfWithGemini(req.file.buffer);
          isOcrFallback = true;
        } catch (geminiError) {
          console.error("Lỗi khi chạy Gemini OCR fallback:", geminiError.message);
        }
      }

      if (!extractedText) return res.status(400).json({ error: 'Tệp PDF trống hoặc không thể trích xuất văn bản (cả bằng pdf-parse và Gemini OCR).' });

      const { docType, topicId } = req.body;
      const newDoc = new ReferenceDoc({
        title: req.file.originalname,
        extracted_text: extractedText,
        isActive: true,
        doc_type: docType || 'topic',
        topic_id: docType === 'general_exam' ? '' : (topicId || '')
      });

      await newDoc.save();

      return res.status(201).json({
        message: isOcrFallback 
          ? 'Tải lên thành công! Phát hiện tài liệu dạng ảnh quét, hệ thống đã dùng Gemini OCR để trích xuất chữ và công thức Toán.' 
          : 'Tải lên và trích xuất văn bản PDF thành công bằng chế độ kỹ thuật số!',
        document: {
          _id: newDoc._id,
          title: newDoc.title,
          text_length: extractedText.length,
          isActive: newDoc.isActive,
          doc_type: newDoc.doc_type,
          topic_id: newDoc.topic_id
        }
      });
    } catch (error) {
      console.error("Lỗi xử lý file PDF:", error.message);
      return res.status(500).json({ error: `Lỗi xử lý PDF: ${error.message}` });
    }
  }

  // Streaming Mode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const writeProgress = (status, step, message) => {
    res.write(JSON.stringify({ status, step, message }) + '\n');
  };

  try {
    if (!req.file) {
      writeProgress('error', 'validate', 'Vui lòng chọn tệp PDF để tải lên.');
      return res.end();
    }

    writeProgress('progress', 'upload', `Tải lên tệp thành công: ${req.file.originalname} (${req.file.size} bytes). Bắt đầu trích xuất...`);
    let extractedText = '';
    let isOcrFallback = false;

    writeProgress('progress', 'pdf_parse', 'Đang phân tích cấu trúc tệp PDF kỹ thuật số (pdf-parse)...');
    try {
      const p = new PDFParse({ data: req.file.buffer });
      const pdfData = await p.getText();
      extractedText = pdfData.text.trim();
    } catch (parseError) {
      writeProgress('progress', 'pdf_parse_warn', `Cảnh báo trích xuất pdf-parse: ${parseError.message}`);
    }

    const pageNumPattern = /^\s*(--\s*\d+\s*of\s*\d+\s*--\s*)*\s*$/;
    const isScannedOrShort = !extractedText || extractedText.length < 300 || pageNumPattern.test(extractedText);

    if (isScannedOrShort) {
      writeProgress('progress', 'ocr_start', 'Phát hiện tài liệu dạng ảnh quét hoặc chứa ít văn bản. Bắt đầu kích hoạt Gemini OCR...');
      try {
        const { extractTextFromPdfWithGemini } = await import('../services/aiService.js');
        writeProgress('progress', 'ocr_gemini', 'Đang gửi dữ liệu hình ảnh PDF đến Gemini OCR để nhận diện chữ và ký hiệu toán học...');
        extractedText = await extractTextFromPdfWithGemini(req.file.buffer);
        isOcrFallback = true;
        writeProgress('progress', 'ocr_success', `Nhận diện OCR thành công! Trích xuất được ${extractedText.length} ký tự.`);
      } catch (geminiError) {
        writeProgress('progress', 'ocr_error', `Lỗi chạy Gemini OCR: ${geminiError.message}`);
      }
    } else {
      writeProgress('progress', 'pdf_parse_success', `Trích xuất văn bản kỹ thuật số thành công: ${extractedText.length} ký tự.`);
    }

    if (!extractedText) {
      writeProgress('error', 'extract_fail', 'Tệp PDF trống hoặc không thể trích xuất văn bản.');
      return res.end();
    }

    writeProgress('progress', 'save_db', 'Đang lưu tài liệu và cập nhật dữ liệu vào cơ sở dữ liệu...');
    const { docType, topicId } = req.body;
    const newDoc = new ReferenceDoc({
      title: req.file.originalname,
      extracted_text: extractedText,
      isActive: true,
      doc_type: docType || 'topic',
      topic_id: docType === 'general_exam' ? '' : (topicId || '')
    });

    await newDoc.save();

    writeProgress('success', 'complete', 'Nạp tài liệu thành công!');
    res.write(JSON.stringify({
      status: 'success',
      data: {
        message: isOcrFallback 
          ? 'Tải lên thành công! Phát hiện tài liệu dạng ảnh quét, hệ thống đã dùng Gemini OCR để trích xuất chữ và công thức Toán.' 
          : 'Tải lên và trích xuất văn bản PDF thành công bằng chế độ kỹ thuật số!',
        document: {
          _id: newDoc._id,
          title: newDoc.title,
          text_length: extractedText.length,
          isActive: newDoc.isActive,
          doc_type: newDoc.doc_type,
          topic_id: newDoc.topic_id
        }
      }
    }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ status: 'error', error: error.message }) + '\n');
    res.end();
  }
});

// GET /api/admin/documents - Lấy tất cả tài liệu tham khảo đã tải lên
router.get('/documents', async (req, res) => {
  try {
    const docs = await ReferenceDoc.find({}).select('-extracted_text').sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/reference/:id/active - Bật/Tắt hoạt động của tài liệu (toggle isActive)
router.put('/reference/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tìm tài liệu để thay đổi trạng thái hoạt động
    const doc = await ReferenceDoc.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu.' });
    }
    
    doc.isActive = !doc.isActive;
    await doc.save();
    
    res.json({ message: `Đã ${doc.isActive ? 'nạp' : 'hủy nạp'} tài liệu thành công.`, document: doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/reference/:id/classify - Cập nhật phân loại và chủ đề của tài liệu
router.put('/reference/:id/classify', async (req, res) => {
  try {
    const { id } = req.params;
    const { docType, topicId } = req.body;
    
    const doc = await ReferenceDoc.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu.' });
    }
    
    doc.doc_type = docType || 'topic';
    doc.topic_id = docType === 'general_exam' ? '' : (topicId || '');
    await doc.save();
    
    res.json({ message: 'Đã cập nhật phân loại chủ đề tài liệu thành công.', document: doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/reference - Lấy thông tin tài liệu hoạt động hiện tại
router.get('/reference', async (req, res) => {
  try {
    const doc = await ReferenceDoc.findOne({ isActive: true }).select('-extracted_text'); // Không lấy trường text quá lớn
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/reference/:id - Xóa tài liệu tham khảo
router.delete('/reference/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await ReferenceDoc.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu để xóa.' });
    }
    res.json({ message: 'Đã xóa tài liệu tham khảo thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/analyze-topics - Phân tích trích xuất chủ đề từ nhiều PDF
router.post('/analyze-topics', upload.array('pdfs', 10), async (req, res) => {
  const isStream = req.query.stream === 'true';

  if (!isStream) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Vui lòng chọn ít nhất một tệp PDF.' });
      }

      console.log(`Đang phân tích trích xuất chủ đề từ ${req.files.length} tệp PDF...`);
      let combinedText = '';

      for (const file of req.files) {
        const p = new PDFParse({ data: file.buffer });
        const pdfData = await p.getText();
        combinedText += pdfData.text + '\n';
      }

      if (!combinedText.trim()) {
        return res.status(400).json({ error: 'Không thể trích xuất văn bản từ các tệp PDF.' });
      }

      const suggestedTopics = await analyzeTopicsWithGemini(combinedText);
      return res.json(suggestedTopics);
    } catch (error) {
      console.error("Lỗi phân tích chủ đề từ PDF:", error);
      return res.status(500).json({ error: `Lỗi phân tích chủ đề: ${error.message}` });
    }
  }

  // Streaming Mode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const writeProgress = (status, step, message) => {
    res.write(JSON.stringify({ status, step, message }) + '\n');
  };

  try {
    if (!req.files || req.files.length === 0) {
      writeProgress('error', 'validate', 'Vui lòng chọn ít nhất một tệp PDF.');
      return res.end();
    }

    writeProgress('progress', 'init', `Bắt đầu quét và phân tích ${req.files.length} tệp PDF...`);
    let combinedText = '';

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      writeProgress('progress', `parse_${i}`, `[${i + 1}/${req.files.length}] Đang trích xuất văn bản từ tệp ${file.originalname}...`);
      
      try {
        const p = new PDFParse({ data: file.buffer });
        const pdfData = await p.getText();
        combinedText += pdfData.text + '\n';
      } catch (parseError) {
        writeProgress('progress', `parse_warn_${i}`, `Cảnh báo trích xuất ${file.originalname}: ${parseError.message}`);
      }
    }

    if (!combinedText.trim()) {
      writeProgress('error', 'empty_text', 'Không thể trích xuất văn bản từ các tệp PDF.');
      return res.end();
    }

    writeProgress('progress', 'call_ai', 'Đang phân tích nội dung văn bản và trích xuất các chủ đề thi bằng Gemini (khoảng 5-10 giây)...');
    const suggestedTopics = await analyzeTopicsWithGemini(combinedText);

    writeProgress('success', 'complete', 'Quét chủ đề thi thành công!');
    res.write(JSON.stringify({
      status: 'success',
      data: suggestedTopics
    }) + '\n');
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ status: 'error', error: error.message }) + '\n');
    res.end();
  }
});

// POST /api/admin/topics/batch - Nhập hàng loạt chủ đề
router.post('/topics/batch', async (req, res) => {
  try {
    const { topics } = req.body;
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'Danh sách chủ đề không hợp lệ.' });
    }

    const results = [];
    for (const t of topics) {
      try {
        const topic = await Topic.findOneAndUpdate(
          { topic_id: t.topic_id },
          { name: t.name, chapter: t.chapter, grade: parseInt(t.grade) },
          { upsert: true, new: true }
        );
        results.push(topic);
      } catch (err) {
        console.error(`Lỗi lưu chủ đề ${t.topic_id}:`, err.message);
      }
    }

    res.status(201).json({ message: `Đã nhập thành công ${results.length} chủ đề.`, topics: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/topics - Tạo một chủ đề thủ công
router.post('/topics', async (req, res) => {
  try {
    const { name, topic_id, chapter, grade } = req.body;
    if (!name || !topic_id || !chapter || !grade) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ các trường.' });
    }

    const existing = await Topic.findOne({ topic_id });
    if (existing) {
      return res.status(400).json({ error: 'Mã chủ đề này đã tồn tại trên hệ thống.' });
    }

    const newTopic = new Topic({
      name,
      topic_id,
      chapter,
      grade: parseInt(grade)
    });
    await newTopic.save();

    res.status(201).json({ message: 'Tạo chủ đề thủ công thành công!', topic: newTopic });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/topics/:id - Xóa một chủ đề
router.delete('/topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Topic.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Không tìm thấy chủ đề để xóa.' });
    }
    res.json({ message: 'Đã xóa chủ đề thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
