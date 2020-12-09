const express = require('express');
const router = express.Router();


const auth = require('../../middleware/auth');

const resizeImage = require('../../middleware/resizeImage');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const level  = require('../../utils/LogLevel')

const { check, validationResult } = require('express-validator');

const Blog = require('../../models/Blog');
const Logs = require('../../models/Logs');
const Section = require('../../models/Section');

const { getNextSequence, base64String, base64StringVideo, generateUniqueName, logError, isEmpty } = require('../../utils/myUtils')

const multer = require('multer');
const { isNull } = require('util');
// const { isEmpty } = require('lodash');
const memStorage = multer.memoryStorage()
//fieldSize = 8mb
var upload = multer({storage: memStorage, limits: {paths: 2, fieldSize: 8000000 , fields: 15, files: 10 }})
                    .fields([
                        {name: 'titleImage', maxCount: 1},
                        {name: 'videos', maxCount: 1},
                        {name: 'section1Img', maxCount: 1},
                        {name: 'section2Img', maxCount: 1},
                        {name: 'section3Img', maxCount: 1},
                        {name: 'section4Img', maxCount: 1},
                        {name: 'section5Img', maxCount: 1},
                        {name: 'section6Img', maxCount: 1}
                    ])


// @route    GET api/blog
// @desc     Get all blogs in db
// @access   Public
router.get('/', async (req, res, next) => {
    try {

        console.log(typeof req.query.sort)
        var blogs, header 

        const filter = req.query.filter === undefined  || req.query.filter === '{}' ? {} : JSON.parse(req.query.filter)
        const range = req.query.range === undefined ? {} : JSON.parse(req.query.range)
        const sort = req.query.sort === undefined ? {} : req.query.sort === 'id'? req.query.sort : JSON.parse(req.query.sort)
        const page = req.query.page === undefined ? {} : JSON.parse(req.query.page)
        const perPage = req.query.perPage === undefined ? {} : JSON.parse(req.query.perPage)
        const order = req.query.order === undefined ? {} : req.query.order

        // console.log("[BLOGS - DECODEDURL]", decodeURIComponent(req.url.replace(/\+/g, ' ')))

        const count = await Blog.countDocuments({}).exec()

        if (Object.keys(req.query).length === 0) {

          blogs = await Blog.find({},{__v: 0, _id: 0, date:0})     

          if (!blogs) return res.status(404).json("Blogs not Found")

          console.log("[Default]", blogs.length)
        
          const blogtoReturn = await Blog.findChunksForBlog(blogs)
          Blog.setContentLimit(res, header, [1, count], count) //add static func GetContentLimit
          return res.status(206).json(blogtoReturn)

        }else{

          if(Object.keys(range).length !== 0 && Array.isArray(sort)){
  
            if (Object.keys(filter).length === 0){
                
                //pass all blogs length to sort
                blogs = await Blog.sort(sort, range)
                if (!blogs) return res.status(404).json("Blog not found")
                console.log("[BLOG - SORT]", blogs.length)

                const blogtoReturn = await Blog.findChunksForBlog(blogs)
                Blog.setContentLimit(res, header, range, count)
                return res.status(206).json(blogtoReturn)
            }

            if (Object.keys(filter).length > 0 && filter.q){
              
                blogs = await Blog.textSearch(filter, sort, range)
                if (!blogs) return res.status(404).json("Blog not Found")
                console.log("[BLOG - QUERY with range]", blogs.length)
                
                const blogtoReturn = await Blog.findChunksForBlog(blogs)
                Blog.setContentLimit(res, header, [0, blogs.length], count)
                return res.status(206).json(blogtoReturn)
            }

          }

        //   /***************** */
        //   if (isEmpty(filter) && sort && perPage && page && order  ){

        //     console.log(page)
        //     console.log(perPage)
        //     console.log(sort)
        //     console.log(order)
        //     blogs = await Blog.find({},{__v:0, _id:0});
        //     if (!blogs) return res.status(404).json("Blogs not found")
        //     console.log("[BLOG - GEATALL 4 Pagination]", blogs.length)
        //     Blog.setContentLimit(res, header, [1, blogs.length], blogs)
        //   }

          if (filter.id){
            blogs = await Blog.find({}, {_id: 0, __v:0}).where("idx").in(filter.id)
            if (!blogs) return res.status(404).json("Blog not Found")
            console.log("[BLOG - FINDMANYBYID]", blogs.length)
            
            const blogtoReturn = await Blog.findChunksForBlog(blogs)
            Blog.setContentLimit(res, header, [1, blogs.length], count)
            return res.status(206).json(blogtoReturn)
          }

          if (Object.keys(page).length > 0 && Object.keys(perPage).length > 0){
              if (filter.q){

                blogs = await Blog.textSearch(filter, [sort, order], ["a", page, perPage])
                if (!blogs) return res.status(404).json("Blog not Found")
                console.log("[BLOG - QUERY with perPage]", blogs.length)

                const blogtoReturn = await Blog.findChunksForBlog(blogs)
                Blog.setContentLimit(res, header, ["a", page, perPage], count)
                return res.status(206).json(blogtoReturn)
                
            }
          }
        }
        
    } catch (error) {
        console.log(error)
        Logs.addLog(level.level.error, error.message, error)
        return res.status(500).json({error : error.message})
    }
})

// @route    GET api/blog/:id
// @desc     Get  blogs by id in db
// @access   Public
router.get('/:id', async (req, res) => {
    try{

        var blog = await Blog.findOne({"idx": req.params.id}, {date:0, __v: 0, _id: 0});

        if (!blog){
            return res.status(404).json("Blog Not found")
        }

        const sectionIds = blog.sections

        const sectionsChunksCollecttion =  mongoose.connection.db.collection("sectionImages.chunks")
        const sectionsFilesCollecttion = mongoose.connection.db.collection("sectionImages.files")

        let sectionDictionary = []
        if(sectionIds){
            for (let sectionId of sectionIds){

                const section = await Section.find({ idx: sectionId}, {_date: 0, __v:0})

                if (!section || section.length === 0){
                    //no section exist
                    continue;
                }
                const sectionFile = await sectionsFilesCollecttion.find({ filename: section[0].image }).toArray();

                if(!sectionFile || sectionFile.length === 0){
                    //no image exist for section
                    continue;
                }

                var secExt = sectionFile[0].filename.split('.')[1]

                const sectionChunk = await sectionsChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(sectionFile[0]._id) }).toArray()

                var chunksJSON = JSON.parse(JSON.stringify(sectionChunk))

                let temp = {
                    text: section[0].text,
                    image: base64String(chunksJSON[0].data, secExt)
                }
                sectionDictionary.push(temp)
            }
        }

        const imageName = blog.image

        //Blog Images
        const imageChunksCollecttion =  mongoose.connection.db.collection("BlogImages.chunks")
        const imageFilesCollecttion =  mongoose.connection.db.collection("BlogImages.files")

        var base64Images = []

        if(imageName){

            const imgFile = await imageFilesCollecttion.find({filename:imageName}).toArray()

            if(!imgFile){
                //no images found for blogs
                return res.status(200).json(blog)
            }

            console.log(imgFile.length)

            var ext = imgFile[0].filename.split('.')[1]

            const chunks = await imageChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(imgFile[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))

            base64Images.push(base64String(chunksJSON[0].data, ext))
        }

        blog = JSON.parse(JSON.stringify(blog))
        blog.images_chunk = base64Images
        blog.sections = sectionDictionaro

        console.log(Object.keys(blog))
        return res.status(200).json(blog)

        //Blog Videos
        // const videoChunksCollecttion = await mongoose.connection.db.collection("BlogVideos.chunks")
        // const videoFilesCollecttion = await mongoose.connection.db.collection("BlogVideos.files")
        // var base64Videos = []
        // for (let video of videoNames){
        //     const ress = await videoFilesCollecttion.find({filename:video}).toArray()
        //     if(ress.length === 0 || ress === undefined){
        //         continue;
        //     }
        //     var ext = ress[0].filename.split('.')[1]
        //     const chunks = await videoChunksCollecttion.find({ "files_id": mongoose.Types.ObjectId(ress[0]._id) }).toArray()
        //     var chunksJSON = JSON.parse(JSON.stringify(chunks))
        //     base64Videos.push(base64StringVideo(chunksJSON[0].data, ext))
        // }
        // blog.videos_chunk = base64Videos

    }catch(error){
      Logs.addLog(level.level.error, error.message, error)
      return res.status(500).json({error : error.message})
    }
})


// @route    POST api/blog
// @desc     Add blog to db 
// @access   Private
router.post('/', 
    [
        auth, 
        upload,
        // resizeImage,
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

        const { text, title, } = req.body 

        //asume sections is an array
        const image = req.files['titleImage'] ? req.files['titleImage'] : null

        console.log(req.body)

        var teaser
        if (text.charAt(80)){
            teaser = text.substr(0, 80)
        }else{
            teaser = text
        }

        const sectionBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'sectionImages'
        })
        // console.log("First Image Size", section1Img[0].size/1024/1024)

        let sectionIds = []

        //starting loop from index 1 to ignore titleImage
        for (var i = 1; i < Object.keys(req.files).length-1 ; i++){
            const section = req.files[`section${i}Img`] ? req.files[`section${i}Img`] : null
            const sectionText = req.body[`section${i}`] ? req.body[`section${i}`] : null

            if (section === null && sectionText === ''){
                continue;
            }else{
        
                const secID = await getNextSequence(mongoose.connection.db, 'sectionId')

                if(section && sectionText){
                    const newSecImg = Section.saveBlogImages(res, sectionBucket, section)
                    const sec = Section({
                        idx: secID,
                        // blog: ,
                        text: sectionText,
                        image: newSecImg
                    })
                    await sec.save()
                }else
                if(section && !sectionText){
                    const newSecImg = Section.saveBlogImages(res, sectionBucket, section)
                    const sec = Section({
                        idx: secID,
                        // blog: ,
                        image: newSecImg
                    })
                    await sec.save()
                }else if(!section && sectionText){
                    const sec = Section({
                        idx: secID,
                        // blog: ,
                        text: sectionText,
                    })
                    await sec.save()
                }
                sectionIds.push(parseInt(secID, 10))
            }
        }

        //add photo to bucket
        const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogImages'
        })

        const blogImageNames = Section.saveBlogImages(res, bucket, image)     

        const seq = await getNextSequence(mongoose.connection.db, 'blogId')

        const blog = new Blog({
            idx: seq,
            // user: req.user.id,
            text: text,
            title: title,
            teaser: teaser,
            image: blogImageNames,
            sections: sectionIds
        })

        sectionIds.forEach(async (id, i)=> {
            await Section.findOneAndUpdate({ "idx": id}, { blog: seq})
        })

        const newBlog = await blog.save()

        return res.status(200).json(newBlog)
      
    } catch (error) {
        Logs.addLog(level.level.error, error.message, error)
        return res.status(500).json({error : error.message})
    }
})

// @route DELETE api/blogs/:id
// @desc Delete single blog by Id 
// @access Private
router.delete('/:id', 
    auth,
    async (req, res) => {
    
    try{

        const id = req.params.id ? req.params.id : null

        const blog = await Blog.findOne({"idx": id})

        if (!blog) {
             return res.status(404).json({ msg: 'blog not found' });
        }

        var imageBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogImages'
        })

        var sectionBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'sectionImages'
        })

        // const sectionCollection = mongoose.connection.db.collection('sectionImages.files')

        for (let sectionID of blog.sections){

            const section = await Section.findOne({idx: sectionID})

            if (!section) {continue}

            mongoose.connection.db.collection('sectionImages.files', (err, sectionCollection) => {
                if (!err){
                    sectionCollection.find({ filename: section.image}).toArray((err, data) => {
                        if (!err){
                            data.forEach(dat => {
                                sectionBucket.delete(dat._id, (err) => {
                                    if(!err){
                                        console.log(`section ${section.idx} deleted`)
                                        Logs.addLog(level.level.info, `Section : { id: ${section.idx} } for Blog: { id : ${blog.idx} } Deleted successful`, '')
                                    }
                                })
                            })
                        }
                    })
                }
            })

            await section.remove();
        }

        mongoose.connection.db.collection('BlogImages.files', (err, fileCollection) => {
            if (!err) {
                fileCollection.find({filename: blog.image}).toArray((err, data) => {
                    if (!err){
                        data.forEach(data => {
                            imageBucket.delete(data._id, (err) => {
                                if(!err){
                                    Logs.addLog(level.level.info, `Blog ${blog.idx} Image Deleted successful`, '')
                                }
                            })
                        })
                    }
                })
            }
        })

        // blog.videos.forEach(vid => {
        //     mongoose.connection.db.collection('BlogVideos.files', (err, fileCollection) => {
        //         if(!err){
        //             fileCollection.find({filename: vid}).toArray((err, data) => {
        //                 if(!err){
        //                     data.forEach(data => {
        //                         videoBucket.delete(data._id, (err) => {
        //                             if(!err){
        //                                 Logs.addLog(level.level.info, 'Video Delete successful', '')
        //                             }
        //                         })
        //                     })
        //                 }
        //             })
        //         }
        //     })
        // })
        
        await blog.remove();
        return res.json({"Message" : "Blog Deleted Deleted"})

    }catch(err){
        Logs.addLog(level.level.error, error.message, err)
        return res.status(500).json({error : err.message})
    }
})



// @route DELETE multiple blogs by query - filter api/blogs
// @desc Delete multiple blogs by Id 
// @access Private
router.delete('/', 
    auth,
    async (req, res) => {
    
    try{

        const filter = req.query.filter ? JSON.parse(req.query.filter) : null

        const blogs = await Blog.find({}, {_id: 0, __v:0}).where("idx").in(filter.id) 

        if (!blogs) {
             return res.status(404).json({ msg: 'Blogs not found' });
        }

        var imageBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'BlogImages'
        })

        var sectionBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'sectionImages'
        })
        
        for (let blog of blogs){

            for (let sectionID of blog.sections){

                const section = await Section.findOne({idx: sectionID})
    
                if (!section) { continue; }
                mongoose.connection.db.collection('sectionImages.files', (err, sectionCollection) => {
                    if (!err){
                        sectionCollection.find({ filename: section.image}).toArray((err, data) => {
                            if (!err){
                                data.forEach(dat => {
                                    sectionBucket.delete(dat._id, (err) => {
                                        if(!err){
                                            console.log(`section ${section.idx} deleted`)
                                            Logs.addLog(level.level.info, `Section : { id: ${section.idx} } for Blog: { id : ${blog.idx} } Deleted successful`, '')
                                        }
                                    })
                                })
                            }
                        })
                    }
                })
                await section.remove();
            }

            mongoose.connection.db.collection('BlogImages.files', (err, fileCollection) => {
                logError(err)

                fileCollection.find({ filename: blog.image }).toArray((err, data) => {
                    
                    logError(err)

                    data.forEach(data => {
                        imageBucket.delete(data._id, (err) => {
                            logError(err)
                            Logs.addLog(level.level.info, ` Blog: { id : ${blog.idx} } Image Deleted successful`, '')
                        })
                    })
                })
            })

        }

        await Blog.deleteMany({idx: { $in : filter.id}});
        res.status(200).json({"Message" : "Blog Deleted Deleted"})

    }catch(err){
        Logs.addLog(level.level.error, error.message, error)
        return res.status(500).json({error : error.message})
    }
})


// @route Edit api/blog/
// @desc Edit single blog by Id 
router.put('/', 
    [
        // auth, 
        upload,
        // resizeImage,
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
                        Logs.addLog(level.level.error, error.message, error)
                        return res.status(500).send(error.message)
                    })
                    .on('finish', () => {
                        Logs.addLog(level.level.info, 'Upload Success - {}', '')
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
                        Logs.addLog(level.level.error, error.message, error)
                        return res.status(500).send(error.message + '<<<<<' )
                    })
                    .on('finish', () => {
                        Logs.addLog(level.level.info, 'Upload Success - {}', '')
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
            Logs.addLog(level.level.error, error.message, error)
            return res.status(500).json({error : error.message})
        }


});

//edit blog

module.exports = router;

