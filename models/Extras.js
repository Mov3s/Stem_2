const mongoose = require('mongoose');

const ExtrasSchema = new mongoose.Schema({
  idx: {
    type: Number
  },
  landingText: {
    type: String
  },
  landingImages:[{
    type: String
  }],
  aboutUs:{
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  },
  dateUpdated:{
    type: String,
    default: Date.now
  }
});

module.exports = Extras = mongoose.model('extras', ExtrasSchema);

