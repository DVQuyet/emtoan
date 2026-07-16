import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  options: {
    type: Map,
    of: String,
    required: true
  },
  correct_answer: {
    type: String,
    required: true
  },
  metadata: {
    topic: { type: String, required: true },
    sub_topic: { type: String },
    difficulty_score: { type: Number },
    source: { type: String }
  },
  ai_analysis: {
    distractor_analysis: {
      type: Map,
      of: String
    },
    socratic_hint: { type: String },
    solution_steps: { type: String }
  },
  embedding: {
    type: [Number],
    default: []
  }
}, {
  timestamps: true,
  collection: 'questions'
});

const Question = mongoose.model('Question', QuestionSchema);
export default Question;
