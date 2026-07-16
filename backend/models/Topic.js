import mongoose from 'mongoose';

const TopicSchema = new mongoose.Schema({
  topic_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  chapter: {
    type: String,
    required: true
  },
  grade: {
    type: Number,
    required: true
  },
  prerequisites: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
  collection: 'topics'
});

const Topic = mongoose.model('Topic', TopicSchema);
export default Topic;
