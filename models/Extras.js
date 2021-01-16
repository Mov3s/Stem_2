const mongoose = require('mongoose');

const ExtrasSchema = new mongoose.Schema({
  idx: {
    type: Number,
    unique: true
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
    type: Date,
    default: Date.now
  }
});

module.exports = Extras = mongoose.model('extras', ExtrasSchema);

