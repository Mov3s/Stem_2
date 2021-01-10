const mongoose = require('mongoose');
const {setHeaderForPartial} = require('../utils/myUtils')

const OrdersSchema = new mongoose.Schema({
  idx: {
    type: Number,
    unique: true
  },
  customer_id: {
    type: Number,
    ref: 'customer',
   // required: true
  },
  stripe_email: {
    type: String
  },
  stripe_payment_intent: {
    type: String
  },
  stripe_session_id:{
    type: String
  },
  invoiced:{
    type: Boolean,
    default: false
  },
  reference: {
    type: String,
    required: true
  },
  returned: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['ordered', 'paid', 'invoiced', 'delivered', 'cancelled']
    //ordered [pending invoice] // paid //invoiced //delivered [invoiced] //cancelled [not invoiced]
  },
  basket: [{
      product: {
          type: Number,
          // ref: 'product'
      }, 
      quantity: {
          type: Number
      }, 
  }],
  total_exc_taxes: {
    type: Number
  },
  total: {
    type: Number,
  },
  tax_rate:{
    type: Number,
  },
  tax_amount: {
    type: Number,
    default: 0
  },
  delivery_fee: {
    type: Number,
  },
}, { timestamps: true });


OrdersSchema.statics.textSearch = (filter, sort, range, cb) => {
  if(sort[1] === 'ASC') {

    return Orders.find({ 
                    reference: {$regex: filter.q, $options:'i'},
                    status: filter.status})
                .sort(`${sort[0]}`)
                .limit(parseInt(range[1], 10) + 1)
                .exec(cb)
  }else{

    return Orders.find({ 
                   reference: {$regex: filter.q, $options:'i'},
                   status: filter.status})
                .sort(`-${sort[0]}`)
                .limit(parseInt(range[1], 10) + 1)
                .exec(cb)
  }

}

OrdersSchema.statics.setContentLimit = (res, header, range, resource) => {

    const rangeFirst = range[0] ? parseInt(range[0], 10) : 0
    const rangeLimit = range[1] ? parseInt(range[1], 10) : 10

    if ( resource.length <= range[1]){

          setHeaderForPartial(res, header, rangeFirst, resource.length, resource.length)
          res.status(206).json(resource)
            
    } else{

          setHeaderForPartial(res, header, rangeFirst, rangeLimit+1, resource.length) 
          res.status(206).json(resource) 
    }
}


module.exports = Orders = mongoose.model('orders', OrdersSchema)