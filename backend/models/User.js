import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  grade_level: {
    type: Number,
    required: true
  },
  join_date: {
    type: Date,
    default: Date.now
  },
  knowledge_matrix: {
    type: Map,
    of: Number,
    default: {}
  },
  total_tests_taken: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'users'
});

const User = mongoose.model('User', UserSchema);
export default User;
