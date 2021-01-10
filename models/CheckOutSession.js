const mongoose = require('mongoose');

const CheckOutSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String, 
  },
  user: {
    type: String, //email of user
  },
  stripeuser: {
    type: String,  // stripe user id
  },
  order_id: {
      type: String,
      ref: 'orders',
  },
  completed: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

module.exports = CheckOutSession = mongoose.model('checkoutsession', CheckOutSessionSchema);
