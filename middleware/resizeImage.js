const sharp = require('sharp')
const { generateUniqueName } = require('../utils/myUtils')
const sizeOf = require('buffer-image-size');


const resizeImage = async (req, res, next ) => {

    if (!req.files) return next()

    // const images = req.files['images'] 

    const images = req.files['previews'] ? req.files['previews'] : req.files['images']

    req.body.images = []

    if (images !== undefined && images!== null){

        await Promise.all(
            images.map(async (image, i) => {

                const imagetype = image.mimetype.split('/')[1]
                
                console.log('Image-' + i + '   ' +image.buffer.length)
                console.log('')

                let newBuffer
                if (req.files['previews']){
                    
                    newBuffer = await sharp(image.buffer)
                                .resize(640, 320)
                                .toFormat(imagetype, { quality: 90})
                                .toBuffer()
                                
                }else{

                    // var dimensions = sizeOf(image.buffer)
                    // console.log(dimensions.width, dimensions.height)

                    // const newHeight = dimensions.height/2

                    // console.log(newHeight)

                    newBuffer = await sharp(image.buffer)
                                .resize(2070, 1000)  //1920 width
                                .toFormat(imagetype, { quality: 90})
                                .toBuffer()

                }

                image.buffer = newBuffer
                image.size = newBuffer.length
                req.body.images.push(image)

                console.log('NewImage-' + i + '   ' +newBuffer.length)
                console.log("resize success")
            }),
        )
    }
    next();
}

module.exports = resizeImage
