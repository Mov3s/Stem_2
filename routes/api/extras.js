const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');

const resizeImage = require('../../middleware/resizeImage');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const { level } = require('../../utils/LogLevel')

const { check, validationResult } = require('express-validator');

const Extras = require('../../models/Extras');
const Logs = require('../../models/Logs');

const { getNextSequence, base64String, generateUniqueName } = require('../../utils/myUtils')

const multer = require('multer')
const memStorage = multer.memoryStorage()
//fieldSize = 6mb
var upload = multer({storage: memStorage, limits: {fieldSize: 6000000 , fields: 5, files: 3 }}).fields([{name:'images'}])


// @route    GET api/extra
// @desc     Get extras in db
// @access   Public
router.get('/', async (req, res, next) => {
    try {

        // const { text, image, story} = req.body
        var extras = await Extras.find({}, {__v:0, _id: 0})
        
        if (!extras || extras.length == 0) return res.status(500).json("No data")

        const imageNames = extras.map(img => img.landingImages)
        console.log(imageNames)
        //Extra Images
        const imageChunksCollecttion =  mongoose.connection.db.collection("LandingImages.chunks")

        const imageFilesCollecttion =  mongoose.connection.db.collection("LandingImages.files")
 
        var base64Images = []
 
        for (let image of imageNames[0]){
            
            const ress = await imageFilesCollecttion.find({ filename : image}).toArray()

            if(ress.length === 0 || ress === undefined){
                console.log("Here")
                continue
            }
 
            var ext = ress[0].filename.split('.')[1]
            // console.log(ress[0])
            const chunks = await imageChunksCollecttion.find({ files_id: mongoose.Types.ObjectId(ress[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))
 
            base64Images.push(base64String(chunksJSON[0].data, ext))
             
        }

        extras = JSON.parse(JSON.stringify(extras))
        extras[0].base64 = base64Images
        
        return res.status(200).json([extras[0]])

    } catch (error) {
        console.log(error)
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({[key] : error.message})
    }
})


// @route    GET api/extra
// @desc     Get extras in db
// @access   Public
router.get('/:id', async (req, res, next) => {
    try {

        // const { text, image, story} = req.body
        var extra = await Extras.findOne({ idx: req.params.id}, {__v:0, _id: 0})
        if (!extra) return res.status(500).json("No data")

        const imageNames = extra.landingImages.map(img => img)

        const imageChunksCollecttion =  mongoose.connection.db.collection("LandingImages.chunks")
        const imageFilesCollecttion =  mongoose.connection.db.collection("LandingImages.files")
 
        var base64Images = []
 
        for (let image of imageNames){
            
            const ress = await imageFilesCollecttion.find({ filename : image}).toArray()

            if(!ress || ress.length === 0){
                console.log("Here")
                continue
            }
            var ext = ress[0].filename.split('.')[1]
            const chunks = await imageChunksCollecttion.find({ files_id: mongoose.Types.ObjectId(ress[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))
 
            base64Images.push(base64String(chunksJSON[0].data, ext))
             
        }

        extra = JSON.parse(JSON.stringify(extra))
        extra.base64 = base64Images
        return res.status(200).json(extra)

    } catch (error) {
        console.log(error)
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({[key] : error.message})
    }
})

// @route    POST api/extra
// @desc     Add extra to db 
// @access   Private
router.post('/', 
    [
        auth, 
        upload,
        [
            //for express-validator
        ]
    ], async (req, res, next)=>{
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { landingText, OurStory } = req.body 

        console.log(req.body)
        const image = req.files['images']

        console.log(" Image Size", image)

        const imageNames = image ? image.map(img => generateUniqueName(img.originalname)) : []

        console.log(imageNames)
        //add photo to bucket
        const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'LandingImages'
        })

        if(imageNames.length > 0 ){
            image.forEach((img, index )=> {
                const readablePhotoStream = new Readable();
                readablePhotoStream.push(img.buffer);
                readablePhotoStream.push(null);

                readablePhotoStream.pipe(bucket.openUploadStream(imageNames[index]))
                .on('error', (error) => {
                    Logs.addLog(level.error, error.message, error)
                    return res.status(500).send(error.message + '<<<<<' )
                })
                .on('finish', () => {
                    console.log("success")
                    Logs.addLog(level.info, `Upload Success - ${imageNames[index]}`, '')
                    //next()
                })
            })
        }
        
        const seq = await getNextSequence(mongoose.connection.db, 'extraId')

        const extra = new Extras({
            idx: seq,
            landingText: landingText,
            landingImages: imageNames,
            OurStory: OurStory,
        })

        const newExta = await extra.save()

        return res.status(200).json(newExta)
      
    } catch (error) {
        console.log(error)
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({[key] : error.message})
    }
})


// @route Edit api/extra/
// @desc Edit extras 
// @access   Private
router.put('/', 
    [
        auth, 
        upload,
        [
  
        ]
    ], async (req, res, next) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        try {
    
            const { idx, landingText, OurStory } = req.body   //Add Teaser
            const image = req.files['images']

            console.log(req.body)
            console.log(image)
           
            const extra = await Extras.findOne({ idx: idx}, {__v:0})

            if (!extra){
                return res.status(404).json("No Data")
            }

            const extrasFileCollection = mongoose.connection.db.collection('LandingImages.files')
            const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
                bucketName: 'LandingImages'
            });

            const imageNames = image && image.length > 0 
                ? image.map(img => generateUniqueName(img.originalname))
                : [];

            if (image){

                extra.landingImages.forEach(image => {
                    extrasFileCollection.find({ filename: image }).toArray((err, data) => {
                        if (err) console.log(err)
                        data.forEach(dat => {
                            bucket.delete(dat._id, (err) => {
                                
                                console.log("deleted extras image")
                            })
                        })
                    })   
                })
               

                //add new image    
                if(image && imageNames.length > 0){
                    image.forEach((img, index) => {
                        const readablePhotoStream = new Readable();
                        readablePhotoStream.push(img.buffer);
                        readablePhotoStream.push(null);
        
                        readablePhotoStream.pipe(bucket.openUploadStream(imageNames[index]))
                        .on('error', (error) => {
                            Logs.addLog(level.error, error.message, error)
                            return res.status(500).send(error.message + '<<<<<' )
                        })
                        .on('finish', () => {
                            Logs.addLog(level.info, `Images Uploaded for Extra - ${extra.idx}`, '')
                            console.log(`Successfully updated images - ${imageNames[index]}`)
                            //next()
                        })
                    })
                }
            }

            extra.landingText = landingText ? landingText : extra.landingText
            extra.landingImages = imageNames ? imageNames : extra.landingImages
            extra.OurStory = OurStory ? OurStory : extra.OurStory

            await extra.save()
            return res.status(200).json(extra)
          
        } catch (error) {
            Logs.addLog(level.error, error.message, error)
            const key = level.error
            res.status(500).json({ error : error.message})
        }

});


// @route delete api/extra/:id
// @desc delete extras 
// @access   Private
router.delete('/:id', 
    [
        auth, 
        upload,
        [ ]
    ], async (req, res, next) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        try {
    
            const extra = await Extras.findOne({ idx: req.params.id}, {__v:0})

            if (!extra){
                return res.status(404).json({NotFound: "Extra doesn't exist"})
            }

            const extrasFileCollection = mongoose.connection.db.collection('LandingImages.files')
            const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
                bucketName: 'LandingImages'
            });

            extra.landingImages.forEach(image => {
                extrasFileCollection.find({ filename: image }).toArray((err, data) => {
                    if (err) console.log(err)
                    data.forEach(dat => {
                        bucket.delete(dat._id, (err) => {
                            console.log("deleted extras image")
                        })
                    })
                })   
            })

            await extra.remove()

            return res.status(200).json({success: `Extra - ${extra.idx} Deleted`})

        }catch(e){
            Logs.addLog(level.error, error.message, error)
            const key = level.error
            res.status(500).json({ error : error.message})
        }
})

module.exports = router;




