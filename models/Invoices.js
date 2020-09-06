const mongoose = require('mongoose');
const { setHeaderForPartial } = require('../utils/myUtils')

const InvoicesSchema = new mongoose.Schema({
  order_id: {
    type: Number,
    ref: 'orders'
  },
  idx:{
    type: Number,
    unique: true
  },
  customer_id: {
    type: String,
    ref: 'customer'
  },
  reference: {
    type: String,
    required: true
  },
  date: {
      type: Date,
      default: Date.now
  },
  delivery_fee: {
      type: Number,
  },
  tax_rate: {
    type: Number,
  },
  taxes: {
    type: Number,
  },
  total: {
    type: Number,
  },
  total_exc_tax: {
    type: Number,
  },
  dateUpdated: {
    type: Date
  }
});


InvoicesSchema.statics.setContentLimit = (res, header, range, resource) => {

  const rangeArray = range.replace('[', '').replace(']', '').split(',')

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


InvoicesSchema.statics.sort = (sort, range, cb) => {

  var num = parseInt(range[1])

  if (sort[1] === 'ASC'){
      return Invoices.find({}, {_id: 0, __v:0}).limit(num).sort(sort[0]).exec(cb)
  }else{
      return Invoices.find({}, {_id: 0, __v:0}).limit(num).sort(-sort[0]).exec(cb)
  }
}


InvoicesSchema.statics.textSearch = (filter, sort, range, cb) => {

  if(sort[1] === 'ASC') {

    return Invoices.find({ name: {$regex: filter.q, $options:'i'}}, {_id: 0, __v:0})
                  .sort(`${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
  }else{

    return Invoices.find({ name: {$regex: filter.q, $options:'i'} }, {_id: 0, __v:0})
                  .sort(`-${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
  }

}

module.exports = Invoices = mongoose.model('invoices', InvoicesSchema);


//routes for OrderHistory
//routes for Extras
// get previews with product 