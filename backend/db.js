import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/webkiemtratoan';

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
