const mongoose = require('mongoose')
const {  level } = require('../utils/LogLevel')
const Logs = require('./Logs')
const { generateUniqueName } = require('../utils/myUtils')
const { Readable } = require('stream');


const SectionSchema = new mongoose.Schema({
    idx: {
        type: Number,
    },
    blog: {
        type: Number,
        ref: 'blog'
    },
    text: {
        type: String,
    },
    image: {
        type: String,
    },
})



SectionSchema.statics.saveBlogImages = (res, bucket, files) => {
    if(files.length > 0){
        const newName = generateUniqueName(files[0].originalname)
        const readable = new Readable()
        readable.push(files[0].buffer);
        readable.push(null);

        readable.pipe(bucket.openUploadStream(newName))
        .on('error', (error) => {
            Logs.addLog(level.error, error.message, error)
            return res.status(500).send(error.message)
        })
        .on('finish', () => {
            Logs.addLog(level.info, `Upload Success - ${newName}`, '')
            //next()
        })
        return newName
    }
}

module.exports = Section = mongoose.model('section', SectionSchema)
 