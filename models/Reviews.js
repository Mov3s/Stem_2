const mongoose = require('mongoose');
const { setHeaderForPartial } = require('../utils/myUtils')


const ReviewsShema = new mongoose.Schema({
  idx: {
    type: String,
    unique: true
  },
  comment: {
    type: String,
  },
  customer_id:{
    type: Number,
    ref: 'customer'
  },
  product_id: {
    type: Number,
    ref: 'product'
  },
  rating: {
    type: Number
  },
  status: {
    type: String,
    default: 'Pending'
    //Accepted, Rejected, Pending
  },
  date: {
    type: Date,
    default: Date.now
  }
});


ReviewsShema.statics.setContentLimit = (res, header, range, count) => {

  // const rangeArray = range.replace('[', '').replace(']', '').split(',')
      var rangeFirst = range[0] ? parseInt(range[0]) : 0
      var rangeLimit = range[1] ? parseInt(range[1]) : 9

      if (count <= rangeLimit){

        rangeLimit = rangeLimit - rangeFirst

        const remaining = rangeFirst === 0 && count - rangeFirst

        if (remaining < rangeLimit){
          setHeaderForPartial(res, header, rangeFirst, remaining + 1, count)
          console.log("REVIEWS -  NEW IF")

        }else{
          setHeaderForPartial(res, header, rangeFirst, rangeLimit + 1, count)
          console.log("REVIEWS - HERE")
       }
        
      } else{
  
          rangeLimit = rangeLimit - rangeFirst
          setHeaderForPartial(res, header, rangeFirst, rangeLimit + 1, count) 
          console.log("REVIEWS - HERE 34567890")
      }
}


ReviewsShema.statics.sort = (sort, range, cb) => {

  if (sort[1] === 'ASC'){
      return Reviews.find({}, {_id: 0, __v:0}).limit(range[1] + 1).sort(sort[0]).exec(cb)
  }else{
      return Reviews.find({}, {_id: 0, __v:0}).limit(range[1] + 1).sort(-sort[0]).exec(cb)
  }
}


ReviewsShema.statics.textSearch = (filter, sort, range, cb) => {

  if(sort[1] === 'ASC') {

    return Reviews.find({ name: {$regex: filter.q, $options:'i'}}, {_id: 0, __v:0})
                  .sort(`${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
  }else{

    return Reviews.find({ name: {$regex: filter.q, $options:'i'} }, {_id: 0, __v:0})
                  .sort(`-${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
  }

}

module.exports = Reviews = mongoose.model('reviews', ReviewsShema);
