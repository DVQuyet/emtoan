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
