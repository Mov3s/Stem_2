const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  idx: {
    type: String,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = User = mongoose.model('user', UserSchema);


//Finish Product schema
///Define relationships between dbs 
//Handle routes for home, view product, buy product, add product, edit product, sign up, login, 