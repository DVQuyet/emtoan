import mongoose from 'mongoose';

const ReferenceDocSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  extracted_text: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  doc_type: {
    type: String,
    enum: ['topic', 'general_exam'],
    default: 'topic'
  },
  topic_id: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'reference_docs'
});

const ReferenceDoc = mongoose.model('ReferenceDoc', ReferenceDocSchema);
export default ReferenceDoc;
