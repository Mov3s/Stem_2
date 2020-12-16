const mongoose = require('mongoose');
const { setHeaderForPartial } = require('../utils/myUtils')

const CustomerSchema = new mongoose.Schema({
  idx: {
      type: Number,
      unique: true
  },
  firstname: {
    type: String
  },
  lastname:{
      type: String
  },
  user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
      //get from req
  },
  address:{
      type: String,
  },
  birthday: {
      type: Date
  },
  country: {
    type: String
  },  
  city: {
    type: String
  },
  email: {
    type: String
  },
  first_seen:{
      type: Date,
      default: Date.now
      //update on first loging/ user creation
  },
  last_seen:{
      type: Date,
      default: Date.now
      //update on last logout
  },
  latest_purchase:{
      type: Date,
      //update on last purchase 
  },
  nb_orders: {
      type: Number,
      default: 0,
      //update on last purchase
  },
  totalSpent: {
      type: Number,
      default: 0
      //update on last purchase
  },
  eirCode:{
      type: String
  },
  groups: {
      type: [String]
  },
  has_ordered: {
      type: Boolean,
      default: false
      //update on first purchase
  },
  has_newsletter: {
    type: Boolean,
    default: false
    //update on sub for newsletter
  },
});


CustomerSchema.statics.setContentLimit = (res, header, range, resource) => {


    const rangeArray = range
    // const rangeArray = range.replace('[', '').replace(']', '').split(',')
  
    const rangeFirst = parseInt(rangeArray[0], 10)
    const rangeLimit = parseInt(rangeArray[1], 10)
  
    if ( resource.length <= rangeLimit){
  
        setHeaderForPartial(res, header, rangeFirst, resource.length, resource.length)
        res.status(206).json(resource)
        
    } else{
  
        setHeaderForPartial(res, header, rangeFirst, rangeLimit+1, resource.length) 
        res.status(206).json(resource) 
    }
}

CustomerSchema.statics.sort = (sort, range, cb) => {

    var num = parseInt(range[1])
  
    if (sort[1] === 'ASC'){
        return Customer.find({}, {_id: 0, __v:0}).limit(num).sort(sort[0]).exec(cb)
    }else{
        return Customer.find({}, {_id: 0, __v:0}).limit(num).sort(-sort[0]).exec(cb)
    }
  }
  
  
CustomerSchema.statics.textSearch = (filter, sort, range, cb) => {
  
    if(sort === 'ASC') {
  
      return Customer.find({ name: {$regex: filter.q, $options:'i'}}, {_id: 0, __v:0})
                    .sort(`${sort[0]}`)
                    .limit(parseInt(range[1]+1, 10))
                    .exec(cb)
    }else{
  
      return Customer.find({ name: {$regex: filter.q, $options:'i'} }, {_id: 0, __v:0})
                    .sort(`-${sort[0]}`)
                    .limit(parseInt(range[1]+1, 10))
                    .exec(cb)
    }
  
  }
  

module.exports = Customer = mongoose.model('customer', CustomerSchema);


//routes for OrderHistory
//routes for Extras
// get previews with product 