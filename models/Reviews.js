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


ReviewsShema.statics.setContentLimit = (res, header, range, resource) => {

  // const rangeArray = range.replace('[', '').replace(']', '').split(',')

  const rangeFirst = parseInt(range[0], 10)
  const rangeLimit = parseInt(range[1], 10)

  if ( resource.length <= rangeLimit){

      setHeaderForPartial(res, header, rangeFirst, resource.length, resource.length)
      res.status(206).json(resource)
      
  } else{

      setHeaderForPartial(res, header, rangeFirst, rangeLimit+1, resource.length) 
      res.status(206).json(resource) 
  }
}


ReviewsShema.statics.sort = (sort, range, cb) => {

  if (sort[1] === 'ASC'){
      return Reviews.find({}, {_id: 0, __v:0}).limit(range[1]).sort(sort[0]).exec(cb)
  }else{
      return Reviews.find({}, {_id: 0, __v:0}).limit(range[1]).sort(-sort[0]).exec(cb)
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
