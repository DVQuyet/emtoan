import mongoose from 'mongoose';

const KnowledgeSummarySchema = new mongoose.Schema({
  topic_id: {
    type: String,
    required: true,
    unique: true
  },
  topic_name: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'knowledge_summaries'
});

const KnowledgeSummary = mongoose.model('KnowledgeSummary', KnowledgeSummarySchema);
export default KnowledgeSummary;
