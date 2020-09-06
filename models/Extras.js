const mongoose = require('mongoose');

const ExtrasSchema = new mongoose.Schema({
  landingText: {
    type: String
  },
  landingImages: {
    type: String
  },
  OurStory:{
    type: String
  },
  date: {
    type: String
  },
  dateUpdated:{
    type: String
  }
});

module.exports = Extras = mongoose.model('extras', ExtrasSchema);

