const mongoose = require('mongoose');

const ResetPasswordSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  usedTokens: {
    type: [String]
  },
  oldpassword: {
      type: String,
  },
  newpassword: {
     type: String  
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = Review = mongoose.model('resetpassword', ResetPasswordSchema);
