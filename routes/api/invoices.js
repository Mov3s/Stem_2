const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const { check, validationResult } = require('express-validator');

const Invoices = require('../../models/Invoices');
const Customer = require('../../models/Customer');
const User = require('../../models/User');
const Orders = require('../../models/Orders');

const { getNextSequence } = require('../../utils/myUtils')


// ******************ADMIN
// @route    GET api/invoices
// @desc     Get all invoices in db
// @access   Private - for admin
router.get('/', auth, async (req, res, next) => {

    try{

        const filter = req.query.filter === undefined  || req.query.filter === '{}' ? {} : JSON.parse(JSON.stringify(req.query.filter))
        const range = req.query.range === undefined ? {} : JSON.parse(JSON.stringify(req.query.range))
        const sort = req.query.sort === undefined ? {} : JSON.parse(JSON.stringify(req.query.sort))

        // console.log("[INVOICES - DECODEDURL]", decodeURIComponent(req.url.replace(/\+/g, ' ')))

        var invoices, header

        if (Object.keys(req.query).length === 0 ){
             invoices = await Invoices.find({}, { __v: 0, _id: 0})

            if (invoices.length === 0) return res.status(404).json("Invoices Empty")

            res.status(200).json(invoices)
        }else{

            if(range && sort){
            
                if (Object.keys(filter).length === 0){
                    invoices = await Invoices.sort(sort, range)
                    if (!invoices) return res.status(404).json("Invoice not found")
                    // console.log("[INVOICE - SORT]", invoices)
                    Invoices.setContentLimit(res, header, range, invoices)
                }
    
                if (Object.keys(filter).length > 0 && filter.q){
                    invoices = await Invoices.textSearch(filter, sort, range)
                    if (!invoices) return res.status(404).json("Invoice not Found")
                    // console.log("[INVOICE - QUERY]", invoices)
                    Invoices.setContentLimit(res, header, range, invoices)
                }
            }

            if(Object.keys(filter).length > 0 && filter.id){
            
                invoices = await Invoices.find().where("idx").in(filter.id)
                if (!invoices) return res.status(404).json("Invoice not Found")
                // console.log("[INVOICE - QUERY]", invoices)
                res.status(200).json(invoices)
        
                // Customer.setContentLimit(res, header, range, customers)
              }

        }
      

    }catch(e){
        console.log(e)
        res.status(500).json({"Error":e.message})
    }

})


// ******************ADMIN
// @route    GET api/orders/id
// @desc     Get order by id 
// @access   Private - for admin
router.get('/:idx', auth, async (req, res, next) => {

    try{

       const invoice = await Invoices.findOne({ "idx": req.params.idx}, { __v: 0, _id: 0})

       if (invoice.length === 0) return res.status(404).json("Invoice not found")

       res.status(200).json(invoice)

    }catch(e){
        res.status(500).json({"Error":"Something Went wrong"})
    }

})


// @route    post api/invoices/:orderid
// @desc     Create invoice
// @access   PrivateRoute - for ADMIN 
router.post('/:orderidx', 
        [
            auth,
            [
                check('delivery_fee', 'delivery_fee is required')
                .not()
                .isEmpty(),
                check('tax_rate', 'tax_rate is required')
                .not()
                .isEmpty(),
                check('taxes', 'taxes is required' )
                .not()
                .isEmpty(),
                check('total', 'taxes is required' )
                .not()
                .isEmpty(),
            ]
        ],
        async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{

        const order = await Orders.findOne({"idx":req.params.orderidx})

        if (!order) return res.status(404).json("Order doesnt exist")

        const { total, tax_rate, taxes, delivery_fee, total_exc_tax } = req.body

        const seq = await getNextSequence(mongoose.connection.db, 'invoiceId')

        order.status = "invoiced" 
        order.dateUpdated = Date.now()

        const invoice = new Invoices({
            idx: seq,
            customer_id: order.customer_id,
            order_id: order.idx,
            reference: order.reference,
            delivery_fee: delivery_fee,
            taxes: taxes,
            total: total,
            tax_rate: tax_rate,
            total_exc_tax: total_exc_tax
        })

        const Models = [invoice, order]
        
        await Models.forEach(async (model, i)=> {
            if (!model) {
                // console.log("[GROUP MODELS FAILED]", model)
                return res.status(500).json("Couldn't group Models")
            }

            await model.save()
            console.log( `[COLLECTION] : Index_${i} - ${model.collection.collectionName} Saved`)
        })
     
        res.status(200).json(Models[0])
    
    }catch(e){
        res.status(500).json({"Error":"Something Went wrong"})
    }

})


//PUT EDIT Invoices
//@route     Update - PUT api/orders
// @desc     Edit Orders
// @access   Private - for Admin
router.put('/:invoiceidx', 
        [
            auth,
            [
                check('tax_rate', 'tax_rate is required')
                .not()
                .isEmpty(),
                check('taxes', 'taxes is required' )
                .not()
                .isEmpty(),
                check('total', 'taxes is required' )
                .not()
                .isEmpty(),
                check('reference', 'reference is required' )
                .not()
                .isEmpty(),
            ]
        ],
        async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{

        const invoice = await Invoices.findOne({"idx":req.params.invoiceidx})

        if (!invoice) return res.status(404).json("Invoices doesnt exist")

        const { total, tax_rate, taxes, delivery_fee, reference, total_exc_tax } = req.body

        invoice.delivery_fee = delivery_fee ? delivery_fee : invoice.delivery_fee;
        invoice.total = total ? total : invoice.total;
        invoice.reference = reference ? reference : invoice.reference;
        invoice.taxes = taxes ? taxes : invoice.taxes;
        invoice.tax_rate = tax_rate ? tax_rate : invoice.tax_rate;
        invoice.total_exc_tax = total_exc_tax ? total_exc_tax : invoice.total_exc_tax;

        invoice.dateUpdated = Date.now()

        await invoice.save()

        res.status(200).json(invoice)
    
    }catch(e){
        res.status(500).json({"Error":"Something Went wrong"})
    }
})


//********** ADMIN ******/
// @route DELETE api/customers/:id
// @desc Delete single invoice by Id 
// @access Private - for ADMIN
router.delete('/:idx', auth, async (req, res) => {
    
    try{
        const invoice = await Invoices.findOne({"idx": req.params.idx})

        //!req.params.idx.match(/^[0-9a-fA-F]{24}$/)

        if (!invoice) {
             return res.status(404).json({ msg: 'invoice not found' });
        }
        
        await invoice.remove();
        res.json({"Message" : "Invoice Deleted Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send(err.message)
    }
})


//********** ADMIN ******/
// @route api/invoices - DELETE multiple invoices by (query.filter) 
// @desc Delete multiple invoices by Id 
// @access Private
router.delete('/', auth, async (req, res) => {
    
    try{

        const filter = req.query.filter ? JSON.parse(req.query.filter) : null

        const invoices = await Invoices.find({}, {_id: 0, __v:0}).where("idx").in(filter.id) 
        

        if (!invoices) {
             return res.status(404).json({ msg: 'invoices not found' });
        }

        await Invoices.deleteMany({idx: { $in : filter.id}});
        res.status(200).json({"Message" : "Invoice Deleted Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send(err.message)
    }
})




module.exports = router