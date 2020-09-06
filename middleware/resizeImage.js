const sharp = require('sharp')
const { generateUniqueName } = require('../utils/myUtils')


const resizeImage = async (req, res, next ) => {

    if (!req.files) return next()

    // const images = req.files['images'] 

    const images = req.files['previews'] ? req.files['previews'] : req.files['images']

    req.body.images = []

    if (images !== undefined){
        await Promise.all(
            images.map(async (image) => {
                // const newImageName = generateUniqueName(image.originalname)

                const imagetype = image.mimetype.split('/')[1]

                const newBuffer = await sharp(image.buffer)
                                    .resize(640, 320)
                                    .toFormat(imagetype, { quality: 90})
                                    .toBuffer()
                                    // .toFile(`upload/${newImageName}`);

                image.buffer = newBuffer
                image.size = newBuffer.length
                req.body.images.push(image)
                console.log("success")

            }),
        )
    }

    next();
    
}

module.exports = resizeImage
