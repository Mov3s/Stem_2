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
var upload = multer({storage: memStorage, limits: {fieldSize: 6000000 , fields: 5, files: 2 }}).fields([{name:'image'}])


// @route    GET api/extra
// @desc     Get extras in db
// @access   Public
router.get('/', async (req, res, next) => {
    try {

        // const { text, image, story} = req.body
        const extra = await Extras.find({}, {__v:0, _id: 0})
        
        if (!extra || extra.length == 0) return res.status(500).json("No Data")
        
        res.status(200).json(extra[0])

    } catch (error) {
        console.log(error)
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
    }
})


// @route    POST api/extra
// @desc     Add extra to db 
// @access   Public
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

        const { landing, ourstory } = req.body 

        const image = req.files['image']

        console.log(" Image Size", image)

        const imageNames = image ? image.map(img => generateUniqueName(img.originalname)) : []

        console.log(imageNames)
        //add photo to bucket
        const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'LandingImage'
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

        console.log("LINE 101",imageNames)
        
        const extra = new Extras({
            landingText: landing,
            landingImage: imageNames[0],
            OurStory: ourstory,
           
        })

        const newExta = await extra.save()

        return res.status(200).json(newExta)
      
    } catch (error) {
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
    }
})


// @route Edit api/extra/
// @desc Edit extras 
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
    
            const { landing, ourstory } = req.body   //Add Teaser
            const image = req.files['image']
           
    
            const extra = await Extras.find({}, {__v:0})

            if (!extra){
                return res.status(404).json("No Data")
            }

            const imageNames = image ? image.map(img => generateUniqueName(img.originalname)) : []
    
            //add photo to bucket
            const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
                bucketName: 'LandingImage'
            })
    
            if(imageNames.length > 0){
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
                        Logs.addLog(level.info, 'Upload Success - {}', '')
                        //next()
                    })
                })
            }

            extra.landingText = landing ? landing : extra.landingText
            extra.landingImage = imageNames.length > 0 ? imageNames[0] : extra.landingImage
            extra.OurStory = ourstory ? ourstory : extra.OurStory

            await extra[0].save()
    
            return res.status(200).json(extra)
          
        } catch (error) {
            Logs.addLog(level.error, error.message, error)
            const key = level.error
            res.status(500).json({key : error.message})
        }

});

module.exports = router;

