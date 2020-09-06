const mongoose = require('mongoose');

const FaqSchema = new mongoose.Schema({
  ip: {
    type: String
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String, 
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = Faq = mongoose.model('Faq', FaqSchema);
