const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');
const resizeImage = require('../../middleware/resizeImage')

//Unused imports, remove later//
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
//******//

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const { check, validationResult } = require('express-validator');

const {getNextSequence, base64String, generateUniqueName, logError } = require('../../utils/myUtils')

const Product = require('../../models/Product');
const Category = require('../../models/Category');

const multer = require('multer')
const memStorage = multer.memoryStorage()
var upload = multer({storage: memStorage, limits: {paths: 2, fieldSize: 6000000 , fields: 15, files: 10 }}).fields([{name:'previews'}])


// @route    GET api/products
// @desc     Get all products in db
// @access   Private
router.get('/', auth, async (req, res, next) => {
    try {

        const filter = req.query.filter === undefined ? {} : JSON.parse(req.query.filter)
        const range = req.query.range === undefined ? {} : JSON.parse(req.query.range)
        const sort = req.query.sort === undefined ? {} : JSON.parse(req.query.sort)

        const order = req.query.order === undefined ? {} : JSON.parse(JSON.stringify(req.query.order))
        const page = req.query.page === undefined ? {} : JSON.parse(JSON.stringify(req.query.page))
        const perPage = req.query.perPage === undefined ? {} : JSON.parse(JSON.stringify(req.query.perPage))

        // console.log("[DECODEDURL]", decodeURIComponent(req.url.replace(/\+/g, ' ')))

        var decodedurl = decodeURIComponent(req.url.replace(/\+/g, ' ')).split('&')

        var sanitize = decodedurl.map((url, i) => {
            if (i === 0){
                url = url.substring(2)
            } 
            return url
        })

        const filterIndex = sanitize.findIndex(ele => ele.includes('filter='))
        const sortIndex = sanitize.findIndex(ele => ele.includes('sort='))
        const rangeIndex = sanitize.findIndex(ele => ele.includes('range='))

        var products, header

        if (Object.keys(req.query).length === 0) {

            products = await Product.find({},{__v: 0, _id:0});
    
            if (!products) return res.status(404).json("Products not Found")

            Product.GetThumbnails(products).then((productList) => {
                Product.setContentLimit(res, header, range, productList)
            })

        }else{

            if( (range && rangeIndex !== -1 )&& (sort  && sortIndex !== -1)){

                if (Object.keys(filter).length === 0 ){
                    products = await Product.sort(sort, range)
                    if (!products) return res.status(404).json("Products not Found")
                    // console.log("[PRODUCT - SORT]",products)

                    Product.GetThumbnails(products).then((productList) => {
                        Product.setContentLimit(res, header, range, productList)
                    })
                }
                if (filter.q){
                    products = await Product.textSearch(filter, sort, range)
                    if (!products) return res.status(404).json("Products not Found")
                    // console.log("[PRODUCT - QUERY]",products)

                    Product.GetThumbnails(products).then((productList) => {
                        Product.setContentLimit(res, header, range, productList)
                    })
                }
            }

            if (filter.category_id){
                
                if (Object.keys(page).length !== 0 && Object.keys(perPage).length !== 0){
                    // console.log("[GETCATEGORY] - [page/perPage]")
                    products = await Product.getByCatgeory(filter.category_id, order, page, perPage, sort)
                    if (!products) return res.status(404).json("Products not Found")

                    Product.GetThumbnails(products).then((productList) => {
                        Product.setContentLimit(res, header, ["a",page, perPage], productList) //a used as flag in static function
                    })

                }

                if( (range && rangeIndex !== -1 )&& (sort  && sortIndex !== -1)){
                    // console.log("[GETCATEGORY] - [range]")
                    products = await Product.findByCategory(filter.category_id, sort, range)
                    if (!products) return res.status(404).json("Products not Found")

                    Product.GetThumbnails(products).then((productList) => {
                        Product.setContentLimit(res, header, range, productList)
                    })
                
                }

            } 
            
            if (filter.id){
        
                products = await Product.find({}, {__id:0, __v: 0}).where("idx").in(filter.id)
                if (!products) return res.status(404).json("Customer not Found")
                // console.log("[PRODUCT - FINDMANY]", products)

                Product.GetThumbnails(products).then((productList) => {
                    Product.setContentLimit(res, header, range, productList)
                })
            }

               
        }
        
    } catch (error) {
        console.log(error)
        res.status(500).json("Server Error Retrieving data")
    }
})

// @route    GET api/products/:id
// @desc     Get products in db by id
// @access   Public
router.get('/:idx', async (req, res, next) => {
    try {

        var product = await Product.findOne({"idx": req.params.idx}, {_id: 0, __v: 0})

        if (!product || product.length === 0){
            return res.status(400).json("Not Found")
        }

        const imagesNames = product.previews.map(preview => preview);

        const chunksCollection =  mongoose.connection.db.collection("previews.chunks")

        const collection = mongoose.connection.db.collection("previews.files")

        var base64Images = []

        for(let prev of imagesNames){

            const ress = await collection.find({ "filename": prev }).toArray()

            var ext = ress[0].filename.split('.')[1]
            const chunks = await chunksCollection.find({ "files_id": mongoose.Types.ObjectId(ress[0]._id) }).toArray()

            var chunksJSON = JSON.parse(JSON.stringify(chunks))

            base64Images.push(base64String(chunksJSON[0].data, ext))
        }

        product = JSON.parse(JSON.stringify(product))

        product.base64Images = base64Images

        res.status(200).json({           
           product
        })

    } catch (error) {
        console.log(error)
        res.status(500).json(error.message)
    }
})


// @route    PUT api/products/:id 
// @desc     Edit product by id in db
// @access   Private
router.put('/', 
    auth, 
    upload,
    [
    check('name', 'Name is required')
    .not()
    .isEmpty(),
    check('price', 'price is required')
    .not()
    .isEmpty(),
    check('stock', 'stock quantity is required')
    .not()
    .isEmpty(),
    ], async (req, res, next) => {

    try {

        const {idx, name, price, stock, benefits, ingredients, size, category_id, sales, reference } = req.body;

        const product = await Product.findOne({"idx": idx})

        if (!product || product.length === 0){
            return res.status(400).json("No Product exists in db")
        }

        const previews = req.files['previews']; //new previews to save

        const productBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'previews'
        })

        if (previews){
            const fileCollection = mongoose.connection.db.collection("previews.files")
        
            ////remove pciture
            product.previews.forEach(prev => {

                fileCollection.find({ filename: prev }).toArray((err, data) => {
                    data.forEach(dat => {
                        productBucket.delete(dat._id, (err) => {
                            console.log("deleted previous images")
                        })
                    })
                })   
            })

            //add new images
            const previewImageNames = previews.map(preview => generateUniqueName(preview.originalname));
            
            previews.forEach(preview => {
                const readablePhotoStream = new Readable();
                readablePhotoStream.push(preview.buffer);
                readablePhotoStream.push(null);
                
                readablePhotoStream.pipe(productBucket.openUploadStream(generateUniqueName(preview.originalname)))
                .on('error', (error) => {
                    return res.status(500).send(error.message + '<<<<<' )
                })
                .on('finish', () => {
                    console.log('Successfully uploaded img')
                })
            })

            product.name = name ? name : product.name;
            product.price = price ? price : product.price;
            product.stock = stock ? stock : product.stock;
            product.benefits = benefits ? benefits : product.benefits;
            product.ingredients = ingredients ? ingredients : product.ingredients;
            product.size = size ? size : productBucket.size;
            product.category_id = category_id ? category_id : product.category_id;
            product.sales = sales ? sales : product.sales;
            product.reference = reference ? reference : product.reference;
            product.previews = previewImageNames

        }else{
            
            product.name = name ? name : product.name;
            product.price = price ? price : product.price;
            product.stock = stock ? stock : product.stock;
            product.benefits = benefits ? benefits : product.benefits;
            product.ingredients = ingredients ? ingredients : product.ingredients;
            product.size = size ? size : product.size;
            product.category_id = category_id ? category_id : product.category_id;
            product.reference = reference ? reference : product.reference;
            product.sales = sales ? sales : product.sales;

        }

        await product.save()
        
        res.status(200).json(product);
        
    } catch (error) {
        console.log(error);
        res.status(500).json({"server Error": error.message});
    }
})




// @route    POST api/products
// @desc     Add products to db 
// @access   Private
router.post("/", 
    [
        auth, 
        upload,
        resizeImage,
        [
        check('name', 'Name is required')
        .not()
        .isEmpty(),
        check('price', 'price is required')
        .not()
        .isEmpty(),
        // check('stock', 'stock quantity is required')
        // .not()
        // .isEmpty(),
        ]
    ], async (req, res, next)=>{
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
        
        const {name, price, stock, benefits, ingredients, size, category_id, sales, reference, images } = req.body;

        const previews = images
        
        const previewImageNames = previews.map(preview => generateUniqueName(preview.originalname));

        const bucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'previews'
        })

        previews.forEach(preview => {
            const readablePhotoStream = new Readable();
            readablePhotoStream.push(preview.buffer);
            readablePhotoStream.push(null);
            // fs.createReadStream(photo.buffer)
            
            readablePhotoStream.pipe(bucket.openUploadStream(generateUniqueName(preview.originalname)))
            .on('error', (error) => {
                res.status(500).send(error.message + '<<<<<' )
            })
            .on('finish', () => {
                console.log('Successfully uploaded img')
            })
        })

        const seq = await getNextSequence(mongoose.connection.db, 'productId')

        const cat = await Category.findOne({"idx":category_id})

        var product = new Product({
            idx: seq,
            name: name,
            price: price,
            stock: stock,
            benefits: benefits,
            ingredients: ingredients,
            reference: reference,
            size: size,
            category_id: cat.idx,
            sales: sales,
            previews: previewImageNames
        })
        
        const newProduct = await product.save();

        res.status(201).json(newProduct);

    } catch (error) {
        console.log(error)
        res.status(500).json("Server Error Adding Products")
    }
})

// @route DELETE api/product/:id
// @desc   Delete single product by Id 
// @access Private
router.delete('/:id', auth, async (req, res) => {
    try{
        const product = await Product.findOne({ "idx": req.params.id })

        if (!product) {
             return res.status(404).json({ msg: 'Product not found' });
        }

        var previewBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'previews'
        })

        product.previews.forEach(preview => {

            mongoose.connection.db.collection('previews.files', (err, fileCollection) => {
                logError(err)

                fileCollection.find({filename: preview}).toArray((err, data) => {

                    logError(err)

                    data.forEach(data => {
                        previewBucket.delete(data._id, (err) => {
                           logError(err)
                            console.log("Delete succesful")
                        })
                    })
                })
            })
        })

        await product.remove();
        res.json({"Message" : "Product Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send({"Error" : err.message})
    }
})


// @route  DELETE api/product/:id/:imagename
// @desc   Delete single Image from product by Id 
// @access Private
router.delete('/:id/:imagename', auth, async (req, res) => {
    try{

        const ImageName = req.params.imagename
        const product = await Product.findOne({"idx":req.params.id})

        const fileToremove = product.previews.filter(preview => preview === ImageName) 

        const filesTokeep = product.previews.filter(preview => preview !== ImageName)

        if (!fileToremove || fileToremove.length === 0){
            return res.status(404).json({'message': 'Image not found'});
        }

        var previewBucket = new mongodb.GridFSBucket(mongoose.connection.db, {
            bucketName: 'previews'
        })

        let filecollection = await mongoose.connection.db.collection('previews.files')

        filecollection.find({filename: ImageName}).toArray((err, data) => {
            logError(err)

            data.forEach(data => {
                previewBucket.delete(data._id, (err) => {
                    logError(err)
                    console.log("File Deleted succesfully")
                   
                })
            })
        })

        product.previews = filesTokeep

        await product.save();

        res.status(200).json({"Message" : "Product IMAGES updated"})

    }catch(err){
        console.log(err.message);
        res.status(500).send("Server Error...")
    }
})


//Get Product Previews by name

//deleteMany




const generateKey = (i) => {
    return `Index${i}`.toString()
}
 


module.exports = router;