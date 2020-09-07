const express = require('express');
const router = express.Router();
const multer = require('multer')

const resizeImage = require('../../middleware/resizeImage')

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')
const fresh = require('fresh')


const auth = require('../../middleware/auth');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const { check, validationResult } = require('express-validator');

const { getNextSequence } = require('../../utils/myUtils')
const { level } = require('../../utils/LogLevel')
const  { isFresh }  = require('../../utils/isFresh')

const Category = require('../../models/Category');
const Logs = require('../../models/Logs');



const memStorage = multer.memoryStorage()    
var upload = multer({
  storage: memStorage,
  limits: {
    fileSize: 4000000,  // max mb; 4000000 = 4mb 
    fields: 1,   // max number of non-file(non-image, non-video, e.t.c) fields
    files: 1   // max number of files to be uploaded
  }
})
.fields([{name:'image'}])


// @route    POST api/category
// @desc     Add category 
// @access   Private
router.post(
  '/',
  [
    auth, 
    upload,
    [
    check('name', 'Please include a valid name')
    .not()
    .isEmpty()
    ]
  ],
  async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {

      const { name } = req.body
      const image = req.files['image']


      // SAVE IMAGE TO MONGO bucket... 
      console.log(image)
      //☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾☝🏾


      // return res.status(200).json("OK")

      const category = await Category.findOne({name: name },{date: 0, __v: 0})

      if (category || category !== null){
          return res.status(400).json("Category already Exists")

      }

      const seq = await getNextSequence(mongoose.connection.db, 'categoryId')
      const newCategory = new Category({
          idx: seq,
          name : name
      })

      await newCategory.save();

      res.status(200).json(newCategory)

    }catch(error) {
      Logs.addLog(level.error, error.message, error)
      const key = level.error
      res.status(500).json({key : error.message})
    }
  }
);


// @route    GET api/categories
// @desc     gett all products by category 
// @access   private
router.get(
    '/',
    auth,
    async (req, res, next) => {

      try {

        // res.append('Last-Modified', (new Date(Date.now())).toUTCString());
        // res.set('Cache-Control', 'public, max-age=604800')
        // res.set('ETag', 'temp')  

        // if(isFresh(req, res)) { //always returns false - REVIEW
        //   return res.status(304).end();
        // }
              
        var categories, header

        const filter = req.query.filter === undefined  || req.query.filter === '{}' ? {} : JSON.parse(req.query.filter)
        const range = req.query.range === undefined ? {} : JSON.parse(JSON.stringify(req.query.range))
        const sort = req.query.sort === undefined ? {} : JSON.parse(JSON.stringify(req.query.sort))

        // console.log("[CATEGORY - DECODEDURL]", decodeURIComponent(req.url.replace(/\+/g, ' ')))

        if (Object.keys(req.query).length === 0) {

          categories = await Category.find({},{date: 0, __v: 0, _id: 0})     

          if (!categories) return res.status(404).json("Products not Found")

          Category.setContentLimit(res, header, range, categories)

        }else{

          if(range && sort){
            
            if (Object.keys(filter).length === 0){

                categories = await Category.sort(sort, range)
                if (!categories) return res.status(404).json("Category not found")
                // console.log("[CATEGORY - SORT]", categories)
                Category.setContentLimit(res, header, range, categories)

            }

            if (Object.keys(filter).length > 0 && filter.q){
              
                categories = await Category.textSearch(filter, sort, range)
                if (!categories) return res.status(404).json("Invoice not Found")
                // console.log("[CATEGORY - QUERY]", categories)
                Category.setContentLimit(res, header, range, categories)

            }

          }

          if (filter.id){
            categories = await Category.find({}, {_id: 0, __v:0}).where("idx").in(filter.id)
            if (!categories) return res.status(404).json("Invoice not Found")
            // console.log("[CATEGORY - FINDMANYBYID]", categories)
            Category.setContentLimit(res, header, range, categories)
          }
      }

      }catch(error){
        Logs.addLog(level.error, error.message, error)
        const key = level.error
        res.status(500).json({key : error.message})
      }
    
});


// @route    GET api/category
// @desc     gett all products by category 
// @access   private
router.get(
  '/:idx',
  auth,
  async (req, res) => {

    try{

      const category = await Category.findOne({"idx": req.params.idx},{date: 0, __v: 0})
  
      if (category === null || category === undefined || category.length === 0){
  
          return res.status(400).json("No Category Exists")

      }

      res.status(200).json(category)

    }catch(error){
      Logs.addLog(level.error, error.message, error)
      const key = level.error
      res.status(500).json({key : error.message})
    }

  }
);


// @route    PUT api/categories/:idx
// @desc     Edit single Category
// @access   private
router.put('/:idx', 
  auth, 
  [
  check('name', 'Please include a valid name')
  .not()
  .isEmpty()
  ],
   async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{
      const { name } = req.body

      const category = await Category.findOne({"idx" : req.params.idx }, {date: 0, __v: 0})

      if (!category || category === null){
          return res.status(400).json("Category doesn't Exists")
      }

      category.name = name

      await category.save();

      res.status(200).json(category)

    }catch(error){
      Logs.addLog(level.error, error.message, error)
      const key = level.error
      res.status(500).json({key : error.message})
    }

})




// @route    DELETE api/categories/:idx
// @desc     DELETE single Category by idx
// @access   private
router.delete('/:idx', auth, async (req, res, next) => {

  try{

    const idx = req.params.idx

    const exists = await Category.findOne({"idx": idx})
    if (!exists) {
      return res.status(404).json("Category doesn't exist")
    }

    const deletedCategory =  await Category.findOneAndDelete({"idx": idx})

    res.status(200).json({"Deleted": deletedCategory})

  }catch(error) {
      Logs.addLog(level.error, error.message, error)
      const key = level.error
      res.status(500).json({key : error.message})
  }

})


module.exports = router;
