const mongoose = require('mongoose');
const { setHeaderForPartial } = require('../utils/myUtils')

const EmailsForNewsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = EmailsForNewsletter = mongoose.model('EmailsForNewsletter', EmailsForNewsletterSchema);


