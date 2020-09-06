const express = require('express');
const router = express.Router();


const auth = require('../../middleware/auth');



const resizeImage = require('../../middleware/resizeImage');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const { level } = require('../../utils/LogLevel')

const { check, validationResult } = require('express-validator');

const Blog = require('../../models/Blog');
const Logs = require('../../models/Logs');

const { getNextSequence, base64String, base64StringVideo, generateUniqueName, logError } = require('../../utils/myUtils')

const multer = require('multer')
const memStorage = multer.memoryStorage()
//fieldSize = 6mb
var upload = multer({storage: memStorage, limits: {paths: 2, fieldSize: 6000000 , fields: 5, files: 10 }}).fields([{name:'images'}, {name: 'videos'}])


// @route    GET api/blog
// @desc     Get all blogs in db
// @access   Public
router.get('/', async (req, res, next) => {
    try {

        var blogs, header 

        const filter = req.query.filter === undefined  || req.query.filter === '{}' ? {} : JSON.parse(req.query.filter)
        const range = req.query.range === undefined ? {} : JSON.parse(req.query.range)
        const sort = req.query.sort === undefined ? {} : JSON.parse(req.query.sort)
        const page = req.query.page === undefined ? {} : JSON.parse(req.query.page)
        const perPage = req.query.perPage === undefined ? {} : JSON.parse(req.query.perPage)
        const order = req.query.order === undefined ? {} : req.query.order

        // console.log("[BLOGS - DECODEDURL]", decodeURIComponent(req.url.replace(/\+/g, ' ')))

        if (Object.keys(req.query).length === 0) {

          blogs = await Blog.find({},{__v: 0, _id: 0})     

          if (!blogs) return res.status(404).json("Blogs not Found")

          Blog.setContentLimit(res, header, range, blogs) //add static func GetContentLimit

        }else{

          if(Object.keys(range).length !== 0 && Array.isArray(sort)){
  
            if (Object.keys(filter).length === 0){
                
                blogs = await Blog.sort(sort, range)
                if (!blogs) return res.status(404).json("Blog not found")
                // console.log("[BLOG - SORT]", blogs)
                Blog.setContentLimit(res, header, range, blogs)

            }

            if (Object.keys(filter).length > 0 && filter.q){
              
                blogs = await Blog.textSearch(filter, sort, range)
                if (!blogs) return res.status(404).json("Blog not Found")
                // console.log("[BLOG - QUERY with range]", blogs)
                Blog.setContentLimit(res, header, range, blogs)

            }

          }

          if (filter.id){
            blogs = await Blog.find({}, {_id: 0, __v:0}).where("idx").in(filter.id)
            if (!blogs) return res.status(404).json("Blog not Found")
            // console.log("[BLOG - FINDMANYBYID]", blogs)
            Blog.setContentLimit(res, header, range, blogs)
          }

          if (Object.keys(page).length > 0 && Object.keys(perPage).length > 0){
              if (filter.q){

                blogs = await Blog.textSearch(filter, [sort, order], ["a", page, perPage])
                if (!blogs) return res.status(404).json("Blog not Found")
                // console.log("[BLOG - QUERY with perPage]", blogs)
                Blog.setContentLimit(res, header, ["a", page, perPage], blogs)
                
            }
          }
          
        }
        
    } catch (error) {
        console.log(error)
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
    }
})

// @route    GET api/blog/:id
// @desc     Get  blogs by id in db
// @access   Public
router.get('/:id', async (req, res) => {
    try{

        var blog = await Blog.findOne({"idx": req.params.id}, {date:0, __v: 0});

        if (!blog){
            return res.status(404).json("Blog Not found")
        }

        const imageNames = blog.images.map(image => image);
        const videoNames = blog.videos.map(video => video);

        //Blog Images
        const imageChunksCollecttion =  mongoose.connection.db.collection("BlogImages.chunks")

        const imageFilesCollecttion =  mongoose.connection.db.collection("BlogImages.files")

        var base64Images = []

        for (let image of imageNames){

            const ress = await imageFilesCollecttion.find({filename:image}).toArray()

            if(ress.length === 0 || ress === undefined){
               continue
            }

            var ext = ress[0].filename.split('.')[1]
            const chunks = await imageChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(ress[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))

            base64Images.push(base64String(chunksJSON[0].data, ext))
            
        }

        //Blog Videos
        const videoChunksCollecttion = await mongoose.connection.db.collection("BlogVideos.chunks")

        const videoFilesCollecttion = await mongoose.connection.db.collection("BlogVideos.files")

        var base64Videos = []

        for (let video of videoNames){

            const ress = await videoFilesCollecttion.find({filename:video}).toArray()

            if(ress.length === 0 || ress === undefined){
                continue;
            }

            var ext = ress[0].filename.split('.')[1]
            const chunks = await videoChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(ress[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))

            base64Videos.push(base64StringVideo(chunksJSON[0].data, ext))
        }

        blog = JSON.parse(JSON.stringify(blog))
        blog.images_chunk = base64Images
        blog.videos_chunk = base64Videos

        res.status(200).json({
            blog
        })

    }catch(error){
      Logs.addLog(level.error, error.message, error)
      const key = level.error
      res.status(500).json({key : error.message})
    }
})


// @route    POST api/blog
// @desc     Add blog to db 
// @access   Private
router.post('/', 
    [
        auth, 
        upload,
        resizeImage,
        [
        check('text', 'text is required')
        .not()
        .isEmpty(),
        ]
    ], async (req, res, next)=>{
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { text, title, images } = req.body 
        const videos = req.files['videos']
        var teaser

        if (text.charAt(80)){
            teaser = text.substr(0, 80)
        }else{
            teaser = text
        }

        console.log(images[0].size/1024/1024)

        const videoNames = videos.length !== 0 ? videos.map(video => generateUniqueName(video.originalname)) : []
        const imageNames = images ? images.map(image => generateUniqueName(image.originalname)) : []

        //add video to bucket
        const videoBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogVideos'
        })

        if (videoNames.length > 0 ) {
            videos.forEach(video => {

                console.log(video)

                const readableVideoStream = new Readable()
                readableVideoStream.push(video.buffer);
                readableVideoStream.push(null);
                readableVideoStream.pipe(videoBucket.openUploadStream(generateUniqueName(video.originalname)))
                .on('error', (error) => {
                    Logs.addLog(level.error, error.message, error)
                    return res.status(500).send(error.message)
                })
                .on('finish', () => {
                    Logs.addLog(level.info, $`Upload Success - {} `, '')
                    //next()
                })
            })
        }

        //add photo to bucket
        const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogImages'
        })

        if(imageNames.length > 0 ){
            images.forEach(image => {
                const readablePhotoStream = new Readable();
                readablePhotoStream.push(image.buffer);
                readablePhotoStream.push(null);

                readablePhotoStream.pipe(bucket.openUploadStream(generateUniqueName(image.originalname)))
                .on('error', (error) => {
                    Logs.addLog(level.error, error.message, error)
                    return res.status(500).send(error.message + '<<<<<' )
                })
                .on('finish', () => {
                    Logs.addLog(level.info, $`Upload Success - {} `, '')
                    //next()
                })
            })
        }

        const seq = await getNextSequence(mongoose.connection.db, 'blogId')

        const blog = new Blog({
            idx: seq,
            user: req.user.id,
            text: text,
            title: title,
            teaser: teaser,
            images: imageNames ? imageNames : [],
            videos: videoNames ? videoNames : []
        })

        const newBlog = await blog.save()

        return res.status(200).json(newBlog)
      
    } catch (error) {
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
    }
})

// @route DELETE api/blogs/:id
// @desc Delete single blog by Id 
// @access Private
router.delete('/:id', auth, async (req, res) => {
    
    try{

        var response = {}

        const id = req.params.id ? req.params.id : null

        const blog = await Blog.findOne({"idx": id})

        if (!blog) {
             return res.status(404).json({ msg: 'blog not found' });
        }

        var imageBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogImages'
        })

        var videoBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogVideos'
        })

        blog.images.forEach(image => {
            mongoose.connection.db.collection('BlogImages.files', (err, fileCollection) => {
                if (!err) {
                    fileCollection.find({filename: image}).toArray((err, data) => {
                        if (!err){
                            data.forEach(data => {
                                imageBucket.delete(data._id, (err) => {
                                    if(!err){
                                        Logs.addLog(level.info, 'Image Delete successful', '')
                                    }
                                })
                             })
                        }
                    })
                }
            })
        })

        blog.videos.forEach(vid => {
            mongoose.connection.db.collection('BlogVideos.files', (err, fileCollection) => {
                if(!err){
                    fileCollection.find({filename: vid}).toArray((err, data) => {
                        if(!err){
                            data.forEach(data => {
                                videoBucket.delete(data._id, (err) => {
                                    if(!err){
                                        Logs.addLog(level.info, 'Video Delete successful', '')
                                    }
                                })
                            })
                        }
                    })
                }
            })
        })
        
        await blog.remove();
        res.json({"Message" : "Blog Deleted Deleted"})

    }catch(err){
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
    }
})



// @route DELETE multiple blogs by query - filter api/blogs
// @desc Delete multiple blogs by Id 
// @access Private
router.delete('/', auth, async (req, res) => {
    
    try{

        const filter = req.query.filter ? JSON.parse(req.query.filter) : null

        const blogs = await Blog.find({}, {_id: 0, __v:0}).where("idx").in(filter.id) 

        if (!blogs) {
             return res.status(404).json({ msg: 'Blogs not found' });
        }

        var imageBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogImages'
        })

        var videoBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogVideos'
        })
        
        for (let blog of blogs){

            blog.images.forEach(image => {

                mongoose.connection.db.collection('BlogImages.files', (err, fileCollection) => {
                    logError(err)
    
                    fileCollection.find({filename: image}).toArray((err, data) => {
                        
                        logError(err)
    
                        data.forEach(data => {
                            imageBucket.delete(data._id, (err) => {
                               logError(err)
                                console.log(data)
                               Logs.addLog(level.info, 'Image Delete successful', '')

                            })
                        })
                    })
                })
            })

            blog.videos.forEach(vid => {
                mongoose.connection.db.collection('BlogVideos.files', (err, fileCollection) => {
                    logError(err)
    
                    fileCollection.find({filename: vid}).toArray((err, data) => {
                        logError(err)
    
                        data.forEach(data => {
                            videoBucket.delete(data._id, (err) => {
                               logError(err)

                               console.log(data)
                               Logs.addLog(level.info, 'Video Delete successful', '')
                                
                            })
                        })
                    })
                })
            })

        }

        


        await Blog.deleteMany({idx: { $in : filter.id}});
        res.status(200).json({"Message" : "Blog Deleted Deleted"})

    }catch(err){
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
    }
})


// @route Edit api/blog/
// @desc Edit single blog by Id 
router.put('/', 
    [
        auth, 
        upload,
        resizeImage,
        [
        check('text', 'text is required')
        .not()
        .isEmpty(),
        ]
    ], async (req, res, next) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        try {
    
            const { idx, text, title, images } = req.body   //Add Teaser
            const videos = req.files['videos']
            var teaser 

            if (text.charAt(80)){
                teaser = text.slice(0, 80)
            }else{
                teaser = text
            }
    
            const blog = await Blog.findOne({"idx":idx})

            if (!blog){
                return res.status(404).json("Blog Not Found")
            }

            const videoNames = videos ? videos.map(video => generateUniqueName(video.originalname)) : []
            const imageNames = images ? images.map(image => generateUniqueName(image.originalname)) : []
    
            //add video to bucket
            const videoBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
                bucketName: 'BlogVideos'
            })

            console.log(req.body)
            console.log(videos)
    
            if (videoNames.length > 0){
                videos.forEach(video => {
    
                    const readableVideoStream = new Readable()
                    readableVideoStream.push(video.buffer);
                    readableVideoStream.push(null);
                    readableVideoStream.pipe(videoBucket.openUploadStream(generateUniqueName(video.originalname)))
                    .on('error', (error) => {
                        Logs.addLog(level.error, error.message, error)
                        return res.status(500).send(error.message)
                    })
                    .on('finish', () => {
                        Logs.addLog(level.info, 'Upload Success - {}', '')
                        //next()
                    })
                })
            }
    
            //add photo to bucket
            const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
                bucketName: 'BlogImages'
            })
    
            if(imageNames.length > 0){
                images.forEach(image => {
                    const readablePhotoStream = new Readable();
                    readablePhotoStream.push(image.buffer);
                    readablePhotoStream.push(null);
    
                    readablePhotoStream.pipe(bucket.openUploadStream(generateUniqueName(image.originalname)))
                    .on('error', (error) => {
                        Logs.addLog(level.error, error.message, error)
                        return res.status(500).send(error.message + '<<<<<' )
                    })
                    .on('finish', () => {
                        Logs.addLog(level.info, 'Upload Success - {}', '')
                        //next()
                    })
                })
            }

            blog.text = text ? text : blog.text
            blog.title = title ? title : blog.title
            blog.teaser = teaser ? teaser : blog.teaser
            blog.images = imageNames.length > 0 ? imageNames : blog.images
            blog.videos = videoNames.length > 0 ? videoNames : blog.videos

            await blog.save()
    
            return res.status(200).json(blog)
          
        } catch (error) {
            Logs.addLog(level.error, error.message, error)
            const key = level.error
            res.status(500).json({key : error.message})
        }


});

//edit blog

module.exports = router;

