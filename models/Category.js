const mongoose = require('mongoose');
const { setHeaderForPartial } = require('../utils/myUtils')

const CategorySchema = new mongoose.Schema({
  idx: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  image:{
    type: String,
  },
  date: {
    type: Date,
    default: Date.now
  }
});

CategorySchema.statics.setContentLimit = (res, header, range, resource) => {

  if(Object.keys(range).length > 0){
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
  }else{

    setHeaderForPartial(res, header, 1, resource.length, resource.length)
    res.status(206).json(resource)
  }
 
}


CategorySchema.statics.sort = (sort, range, cb) => {

  var num = parseInt(range[1])

  if (sort[1] === 'ASC'){
      return Category.find({}, {_id: 0, __v:0}).limit(num).sort(sort[0]).exec(cb)
  }else{
      return Category.find({}, {_id: 0, __v:0}).limit(num).sort(-sort[0]).exec(cb)
  }
}


CategorySchema.statics.textSearch = (filter, sort, range, cb) => {

  if(sort[1] === 'ASC') {

    return Category.find({ name: {$regex: filter.q, $options:'i'}}, {_id: 0, __v:0})
                  .sort(`${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
  }else{

    return Category.find({ name: {$regex: filter.q, $options:'i'} }, {_id: 0, __v:0})
                  .sort(`-${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
  }

}

module.exports = Category = mongoose.model('category', CategorySchema);
