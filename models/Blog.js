const mongoose = require('mongoose');
const {  setHeaderForPartial, base64StringVideo, base64String } = require('../utils/myUtils')
const {  level } = require('../utils/LogLevel')
const Logs = require('../models/Logs')

const _ = require('lodash')

const BlogSchema = new mongoose.Schema({
  idx: {
    type: Number,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }, /// might remove
  title: {
    type: String,
  },
  text: {
    type: String,
    required: true
  },
  teaser:{
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  videos: [{
    type: String
  }], 
  comments: [{
      user: {
          type: Number,
          ref: 'user'
      }, // change to idx
      body: {
          type: String
      }
  }],
  likes: {
    type: Number
    //check increment/decrement by default
  },
  date: {
    type: Date,
    default: Date.now
  },
});

// BlogSchema.index({title: 'text', teaser: 'text', text: 'text'}, {default_language: 'none'});

BlogSchema.statics.setContentLimit = (res, header, range, resource) => {

  if (range[0] === "a" ) {
      console.log("USing Page/Perpage for range")

      var first = (range[2] * range[1]) - range[2]

      if ( resource.length <= rangeLimit){

          setHeaderForPartial(res, header, first, resource.length, resource.length)
          return res.status(206).json(resource)
          
      } else{
  
          setHeaderForPartial(res, header, first, rangeLimit + 1, resource.length) 
          return res.status(206).json(resource) 
      }

  }else{
      const rangeFirst = range[0] ? range[1] : 0
      const rangeLimit = range[1] ? range[1] : 10
  
      if ( resource.length <= rangeLimit){

          setHeaderForPartial(res, header, rangeFirst, resource.length, resource.length)
          return res.status(206).json(resource)
          
      } else{
  
          setHeaderForPartial(res, header, rangeFirst, rangeLimit + 1, resource.length) 
          return res.status(206).json(resource) 
      }
  }
}


///Helper function to get videos and images for Blogs
const findChunksForBlog =  async (blogs) =>{

  var newBlogs = []

  const imageChunksCollecttion =  mongoose.connection.db.collection("BlogImages.chunks")

  const imageFilesCollecttion =  mongoose.connection.db.collection("BlogImages.files")

  const videoChunksCollecttion =  mongoose.connection.db.collection("BlogVideos.chunks")

  const videoFilesCollecttion =  mongoose.connection.db.collection("BlogVideos.files")

  try{

    for (let blog of blogs){
      const imageNames = blog && blog.images ? blog.images.map(image => image): null;

      var eachBlogImage = []
      if (imageNames !== null){
        for (let img of imageNames) {

          // console.log(img)
          
          const blobs = await imageFilesCollecttion.find({ "filename": img }).toArray()

          if (blobs.length > 0){
          
            var ext = blobs[0].filename.split('.')[1]
            const chunks = await imageChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(blobs[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))
            img = img.toString()
          
            eachBlogImage.push( base64String(chunksJSON[0].data, ext))       
          }  

        }
      }

      const videoNames = blog && blog.videos ? blog.videos.map(vid => vid): null;

      var eachBlogVideo = []
      if (videoNames !== null){
        for (let vid of videoNames) {
          const blobs = await videoFilesCollecttion.find({ "filename": vid }).toArray()

          if (blobs.length > 0){
            var ext = blobs[0].filename.split('.')[1]
            const chunks = await videoChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(blobs[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))

            eachBlogVideo.push( base64StringVideo(chunksJSON[0].data, ext))
          }
        }
      }
      
      blog = JSON.parse(JSON.stringify(blog))
      blog.images_chunk = eachBlogImage
      blog.videos_chunk = eachBlogVideo
      newBlogs.push(blog)
    }

  }catch(error){
    console.log(error)
    Logs.addLog(level.error, error.message, error)
  }

  return newBlogs
}


BlogSchema.statics.sort = async (sort, range, cb) => {

  var num = parseInt(range[1] + 1)

  var blog

  if (sort[0] === 'id'){
   
    if (sort[1] === 'ASC'){
      blog = await Blog.find({}, {_id: 0, __v:0}).sort({"idx": 1}).limit(num).exec(cb) 
      blog = await findChunksForBlog(blog)
      return blog

    }else{

      blog = await Blog.find({}, {_id: 0, __v:0}).sort({"idx": -1}).limit(num).exec(cb)
      blog = await findChunksForBlog(blog)
      return blog
   }
   
  }

  if (sort[1] === 'ASC'){
    blog = await Blog.find({}, {_id: 0, __v:0}).sort(sort[0]).limit(num).exec(cb)
    blog = findChunksForBlog(blog)
    return blog
  }else{
    blog = await Blog.find({}, {_id: 0, __v:0}).sort(-sort[0]).limit(num).exec(cb)
    blog = findChunksForBlog(blog)
    return blog
  }

}


BlogSchema.statics.textSearch = (filter, sort, range, cb) => {

  // const regex = new RegExp(/^$/i)

  //lodash to escape regex string, converts to the above to string new RegExp(/^ {filter.q} $/i)
  //$options : i to allow case insenstive searches 
  
  if(sort[1] === 'ASC') {
    return Blog.find({ "$or": [ 
                                { "title" : { $regex: _.escapeRegExp(filter.q), $options: 'i' }}, 
                                { "text" : { $regex: _.escapeRegExp(filter.q), $options: 'i' }}, 
                                { "teaser" : { $regex: _.escapeRegExp(filter.q), $options: 'i' }}
                              ]
                     }, {_id: 0, __v:0} )
                    .sort(`${sort[0]}`)
                    .limit(parseInt(range[1]+1, 10))
                    .exec(cb)
  }else{

    return Blog.find({ "$or": [ 
                                { "title" : { $regex: _.escapeRegExp(filter.q), $options: 'i' }}, 
                                { "text" : { $regex: _.escapeRegExp(filter.q), $options: 'i'}}, 
                                { "teaser" : { $regex: _.escapeRegExp(filter.q), $options: 'i' }}
                              ]
                    }, {_id: 0, __v:0} )
                    .sort(`-${sort[0]}`)
                    .limit(parseInt(range[1]+1, 10))
                    .exec(cb)
  }

}

module.exports = Blog = mongoose.model('blog', BlogSchema);


//Add find chunks for Blog tyo all custom static methods