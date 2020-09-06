const mongoose = require('mongoose');

const CountersSchema = new mongoose.Schema({
  _id: {
    type: String
  },
  seq: {
    type: Number, 
  },
  dateUpdated: {
    type: Date,
    default: Date.now
  },
  date:{
    type: Date,
    default: Date.now
  }
}, {_id: false});

module.exports = Counters = mongoose.model('counters', CountersSchema);
