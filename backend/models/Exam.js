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
