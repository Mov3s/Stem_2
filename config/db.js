const mongoose = require('mongoose');
// const config = require('config');
// const db = config.get('mongoURI');

require('dotenv').config()
const db = process.env.MONGOURI

const Counters = require('../models/Counters')

const connectDB = async () => {
  try {
    await mongoose.connect(db, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useFindAndModify: false,
      useUnifiedTopology: true
    });

    console.log('MongoDB Connected...');

    let count = await Counters.countDocuments({}).exec()

    if (count === 0){
      let entries = [
        { _id: "reviewId", seq : 1}, 
        { _id: "orderId", seq : 1}, 
        { _id: "customerId", seq: 1}, 
        { _id: "invoiceId", seq: 1}, 
        { _id: "blogId", seq : 1},
        { _id: "productId", seq : 1},
        { _id: "userId", seq : 1},
        { _id: "categoryId", seq : 1},
        { _id: "extraId", seq : 1},
        { _id: "sectionId", seq : 1}
      ]
      
      await Counters.insertMany(entries)
    }
    
  } catch (err) {
    console.error(err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
