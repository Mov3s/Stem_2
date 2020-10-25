const mongoose = require("mongoose")
const { setHeaderForPartial, base64String } = require("../utils/myUtils")

const ProductSchema = new mongoose.Schema({
    idx: {
        type: Number,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    benefits:{ 
        type: String
    },
    ingredients:{ 
        type: String
    },
    size: { 
        type: String
    },
    category_id: {
        type: Number,
        ref: 'products'
    },
    reference:{
        type: String
    },
    previews: [{
        type: String
    }],
    price: { 
        type: Number,
        required: true
    },
    stock: {
        type: String, 
        // required: true
    },
    sales: {
        type: Number,  //count sales based on individual unit sold??
        Default: 0
    },
    date: {
        type: Date,
        default: Date.now
    },
    dateUpdated: {
        type: Date,
        default: Date.now
    }
})


///Helper function to get thumbnail, first images in previews
const findChunksForThumbnail =  async (products) =>{

    const chunksCollection = mongoose.connection.db.collection("previews.chunks") 
    const filesCollection = mongoose.connection.db.collection("previews.files")

    const imageName = products.previews.length > 0 ? products.previews[0] :  "No Image";

    if (imageName !== "No Image"){  
        const blobs = await filesCollection.find({ "filename": imageName }).toArray()

        var ext, _imageBinaryJSON

        const blobsJSON = JSON.parse(JSON.stringify(blobs));
        ext = blobsJSON[0].filename.split('.')[1]

        const imageBinary = await chunksCollection.find({ "files_id" : mongoose.Types.ObjectId(blobsJSON[0]._id) }).toArray()
        _imageBinaryJSON = JSON.parse(JSON.stringify(imageBinary))
        products = JSON.parse(JSON.stringify(products))
        products.base64 = base64String(_imageBinaryJSON[0].data, ext)

        return products
    }

    return products
}

ProductSchema.statics.GetThumbnails = async (products) => {

        var productList = []

        if (typeof products === "object" && products.length === undefined) {

            const thumbNail = await findChunksForThumbnail(products)
            productList.push(thumbNail)

        }else{

            for (let prod of products){
                
                const thumbNail = await findChunksForThumbnail(prod)
                
                productList.push(thumbNail)
            }
        }

        return productList
}


ProductSchema.statics.setContentLimit = (res, header, range, count) => {

  if (range[0] === "a" ) {
    console.log("USing Page/Perpage for range")

    var first = (range[1] - 1) * range[2]
    var last = (range[2] * range[1]) - range[2]

    if ( count <= range[2]){

        setHeaderForPartial(res, header, first, count, count)
        console.log("Using PerPage :  count < limit")
        
    } else{

        setHeaderForPartial(res, header, first, last, count) 
        console.log("Using PerPage : count >= limit")
    }

}else{
    var rangeFirst = range[0] ? range[0] : 0
    var rangeLimit = range[1] ? range[1] : 9

    if (count <= rangeLimit){

      rangeLimit = rangeLimit - rangeFirst

      const remaining = count - rangeFirst

      console.log(remaining)
      if (remaining < rangeLimit){
        setHeaderForPartial(res, header, rangeFirst, remaining + 1, count)
        console.log("INSIDE NEW CONTROL")

      }else{
        setHeaderForPartial(res, header, rangeFirst, rangeLimit + 1, count)
        console.log("HERE")

     }
      
    } else{

        rangeLimit = rangeLimit - rangeFirst
        setHeaderForPartial(res, header, rangeFirst, rangeLimit + 1, count) 
        console.log("HERE 34567890")
    }
}
    
}

ProductSchema.statics.findByCategory = (category_id, sort, range, cb) => {

    if (sort[1] === 'DESC'){

        return Product.find({ 
            "category_id": category_id
          }, {__v:0, _id: 0})
        .sort(-sort[0])
        .limit(parseInt(range[1]+1, 10))
        .exec(cb)
    }else{
        return Product.find({ 
            "category_id": category_id
          })
        .sort(sort[0])
        .limit(parseInt(range[1]+1, 10))
        .exec(cb)
    }
    
}

ProductSchema.statics.sort = (sort, range, cb) => {

    if (sort[1] === 'ASC'){
        return Product.find({}, {_id: 0, __v:0}).limit(range[1]).sort(`${sort[0]}`).exec(cb)
    }else{
        return Product.find({}, {_id: 0, __v:0}).limit(range[1]).sort(`-${sort[0]}`).exec(cb)
    }
}

ProductSchema.statics.textSearch = (filter, sort, range, cb) => {
    if(sort[1] === 'ASC') {
  
      return Product.find({ 
                      name: {$regex: filter.q, $options:'i'}
                    }, {_id: 0, __v:0})
                  .sort(`${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
    }else{
  
      return Product.find({ 
                     name: {$regex: filter.q, $options:'i'},
                    }, {_id: 0, __v:0})
                  .sort(`-${sort[0]}`)
                  .limit(parseInt(range[1]+1, 10))
                  .exec(cb)
    }
    //return this.where('name', new RegExp(name, 'i')).exec(cb);  
}

ProductSchema.statics.getByCatgeory = ( category_id, order, page, perPage, sort, cb) =>{

    if (order === 'ASC'){
        return Product.findOne({ "category_id": category_id }, {_id: 0, __v:0})
                    .skip((perPage*page) - perPage)
                    .limit(perPage)
                    .sort(sort)
                    .exec(cb)
    }else{
        return Product.findOne({ "category_id": category_id}, {_id: 0, __v:0})
                    .skip((perPage*page) - perPage)
                    .limit(perPage)
                    .sort(-sort)
                    .exec(cb)
    }
}



module.exports = Product = mongoose.model('product', ProductSchema);
