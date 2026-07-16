import connectDB from './db.js';
import ReferenceDoc from './models/ReferenceDoc.js';
import mongoose from 'mongoose';

async function check() {
  try {
    await connectDB();
    const docs = await ReferenceDoc.find({});
    console.log(`Tìm thấy ${docs.length} tài liệu trong database:`);
    docs.forEach((doc, idx) => {
      console.log(`\nTài liệu ${idx + 1}:`);
      console.log("- ID:", doc._id);
      console.log("- Tiêu đề:", doc.title);
      console.log("- Trạng thái hoạt động (isActive):", doc.isActive);
      console.log("- Loại tài liệu (doc_type):", doc.doc_type);
      console.log("- Chủ đề (topic_id):", doc.topic_id);
      console.log("- Độ dài văn bản trích xuất:", doc.extracted_text ? doc.extracted_text.length : 0);
      if (doc.extracted_text) {
        console.log("- Bản xem trước văn bản (500 ký tự đầu):");
        console.log(doc.extracted_text.substring(0, 500));
      } else {
        console.log("- Không có văn bản trích xuất.");
      }
    });
  } catch (error) {
    console.error("Lỗi:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

check();
