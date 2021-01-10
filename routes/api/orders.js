const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const contentRange = require('content-range');


const { check, validationResult } = require('express-validator');

const Orders = require('../../models/Orders');
const Product = require('../../models/Product');
const Customer = require('../../models/Customer');
const { getNextSequence, setHeaderForPartial } = require('../../utils/myUtils');


// ******************ADMIN
// @route    GET api/orders
// @desc     Get all orders in db
// @access   Private - for admin
router.get('/', auth, async (req, res, next) => {

    try{


        const filter = req.query.filter ? JSON.parse(req.query.filter.toString()) : undefined;
        const sort = req.query.sort ? JSON.parse(req.query.sort.toString()) : undefined;
        const range = req.query.range ? JSON.parse(req.query.range) : undefined;

        var orders;

        if(Object.keys(req.query).length !== 0){

            if (filter === undefined){

                orders = await Orders.find({}, { __v: 0, _id:0})

            }else{

                console.log("perPage/limit Available")

                if(sort !== undefined || range !== undefined){
                    const rangeIntLimit = range[1] ? parseInt(range[1], 10) : 9
                    
                    if (filter.status){
                        sort[1] === "ASC" ?
                            orders = await Orders.find({ status: filter.status }).limit(rangeIntLimit + 1).sort(`${sort[0]}`)
                        :
                            orders = await Orders.find({ status: filter.status }).limit(rangeIntLimit + 1).sort(`-${sort[0]}`)  
                    }

                    if (filter.q ){
                        sort[1] === "ASC" ?
                            orders = await Orders.textSearch(filter, sort[0], rangeIntLimit)
                        :
                            orders = await Orders.textSearch(filter, sort[0], rangeIntLimit)
                    }

                    if(filter.customer_id){
                        sort[1] === "ASC" ? 
                            orders = await Orders.find({"customer_id": filter.customer_id}, {__v: 0, _id: 0 })
                                                 .sort(sort[0])
                                                 .limit(rangeIntLimit+1)
                                                 .exec()
                        :   orders = await Orders.find({"customer_id": filter.customer_id}, {__v: 0, _id: 0 })
                                                 .sort(-sort[0])
                                                 .limit(rangeIntLimit+1)
                                                 .exec()
                    }

                }

                if (filter.id){
                    orders = await Orders.find({}, {_id:0, __v:0}).where("idx").in(filter.id)
                }

            }
        
            if (!orders) return res.status(404).json({"Error":"No Order Exist"})

            var header;

            const rangeFirst = range[0] ? parseInt(range[0], 10) : 0
            const rangeLimit = range[1] ? parseInt(range[1], 10) : 10

            if ( orders.length <= range[1]){
                 setHeaderForPartial(res, header, rangeFirst, orders.length, orders.length)
                 res.status(206).json(orders)
                    
            } else{

                 setHeaderForPartial(res, header, rangeFirst, rangeLimit+1, orders.length) 
                 res.status(206).json(orders) 
            }

        }else{
            orders = await Orders.find({}, {__v:0})

            if(!orders) return res.status(404).json("Order not found")

            res.status(200).json(orders)
        }

    }catch(e){
        console.log(e)
        res.status(500).json({"Error" : e.message})
        
    }

})


// ******************ADMIN
// @route    GET api/orders/id
// @desc     Get order by id 
// @access   Private - for admin
router.get('/:idx', auth, async (req, res, next) => {

    try{

       const order = await Orders.find({"idx":req.params.idx}, { __v: 0})

       if (order.length === 0 || !order) return res.status(404).json("Customer not found")

       res.status(200).json(order)

    }catch(e){
        res.status(500).json({"Error":"Something Went wrong"})
    }

})



// @route    post api/orders
// @desc     Create order
// @access   PrivateRoute - for customers
router.post('/', 
        [
            auth,
            [
                check('reference', 'reference is required')
                .not()
                .isEmpty(),
                check('total', 'total is required')
                .not()
                .isEmpty(),
                check('product_id', 'product is required' )
            ]
        ],
        async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{

        const id = req.user.id

        const user = await User.findById(id)

        if (!user) return res.status(404).json("User doesnt exist")

        const { basket, total, tax_rate, tax_amount, delivery_fee, status, reference, returned } = req.body
        
        if (basket.length > 0){
            basket.forEach(async (basket, i) => {
                const product = await Product.findById(basket.product_id)

                if (status == "ordered"){

                    product.stock = product.stock >= basket.quantity ? product.stock -= basket : product.stock
                    
                    await product.save()
                    console.log(`[Update]:- ${product.name} Updated,  minus Qty ${basket.quantity}`)
                }
            })
        }

        const customer = await Customer.findOne({"user_id": user._id})

        const seq = await getNextSequence(mongoose.connection.db, 'orderId')

        const order = new Orders({
            idx: seq,
            customer_id: customer.idx,
            reference: reference,
            returned: returned,
            status: status,
            basket: basket,
            total: total,
            tax_rate: tax_rate,
            tax_amount: tax_amount,
            delivery_fee: delivery_fee
        })

        const Models = [order]

        await Models.forEach(async (model, i)=> {
            if (!model) {
                return res.status(500).json("Couldn't group Models")
            }

            await model.save()
            console.log( `[MODELSAVED] :  ${model.collection.collectionName} Saved`)
        })
     
        res.status(200).json(Models[0])
    
    }catch(e){
        console.log(e)
        res.status(500).json({"Error":e.message})
    }

})



//@route     Update - PUT api/orders
// @desc     Edit Orders
// @access   Private - for Admin
router.put('/', 
        [
            auth,
            [
                
            ]
        ],
        async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }


    try{

        const {idx, basket, total, tax_rate, tax_amount, delivery_fee, status, reference, returned } = req.body

        const order = await Orders.findOne({ "idx": idx})

        if (!order) return res.status(404).json("Order doesnt exist")

        order.basket = basket ? basket : order.basket
        order.returned = returned ? returned : order.returned;
        order.reference = reference ? reference : order.reference;
        order.returned = returned ? returned : order.returned;
        order.status = status ? status : order.status;
        order.total = total ? total : order.total;
        order.tax_rate = tax_rate ? tax_rate : order.tax_rate;
        order.tax_amount = tax_amount ? tax_amount : order.tax_amount;
        order.delivery_fee = delivery_fee ? delivery_fee : order.delivery_fee
        order.dateUpdated = Date.now()

        await order.save()

        res.status(200).json(order)
    
    }catch(e){
        console.log(e)
        return res.status(500).json({"Error":e.message })
    }
})


//********** ADMIN ******/
// @route DELETE api/customers/:id
// @desc Delete single order by Id 
// @access Private - for ADMIN
router.delete('/:id', auth, async (req, res) => {
    
    try{
        const order = await Orders.findById(req.params.id)

        // req.params.id.match(/^[0-9a-fA-F]{24}$/)

        if (!order) {
            return res.status(404).json({ msg: 'customer not found' });
        }
        
        await order.remove();
        res.json({"Message" : "Order Deleted Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send({"Err": err.message})
    }
})


//********** ADMIN ******/
// @route api/orders - DELETE multiple orders by (query.filter) 
// @desc Delete multiple orders by Id 
// @access Private
router.delete('/', auth, async (req, res) => {
    
    try{

        const filter = req.query.filter ? JSON.parse(req.query.filter) : null

        const orders = await Orders.find({}, {_id: 0, __v:0}).where("idx").in(filter.id) 

        if (!orders) {
             return res.status(404).json({ msg: 'orders not found' });
        }

        await Orders.deleteMany({idx: { $in : filter.id}});
        res.status(200).json({"Message" : "Orders Deleted Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send(err.message)
    }
})



module.exports = router




// console.log(req.query.filter)

// const filter = req.query.filter ? JSON.parse(req.query.filter.toString()) : undefined;
// const sort = req.query.sort ? JSON.parse(req.query.sort.toString()) : undefined;
// const range = req.query.range ? JSON.parse(req.query.range) : undefined;

// var orders, header;

// if(Object.keys(req.query).length === 0){

//     orders = await Orders.find({}, {__v:0})

//     if(!orders) return res.status(404).json("Orders not found")

//     res.status(200).json(orders)
// }else{

//     if(sort !== undefined || range !== undefined){

//         const rangeIntLimit = range[1] ? parseInt(range[1], 10) : 9

//         if (filter.status){
//             sort[1] === "ASC" ?
//                 orders = await Orders.find({ status: filter.status }).limit(rangeIntLimit + 1).sort(`${sort[0]}`)
//             :
//                 orders = await Orders.find({ status: filter.status }).limit(rangeIntLimit + 1).sort(`-${sort[0]}`)  
            
//             if (!orders) return res.status(404).json("Orders Not Found")
//             Orders.setContentLimit(res, header, range, orders)
           
//         }

//         if (filter.q ){

//             orders = await Orders.textSearch(filter, sort, range)
//             if (!orders) return res.status(404).json("Orders Not Found")
//             Orders.setContentLimit(res, header, range, orders)

//         }

//         if(filter.customer_id){
//             sort[1] === "ASC" ? 
//                 orders = await Orders.find({"customer_id": filter.customer_id}, {__v: 0, _id: 0 })
//                                      .sort(sort[0])
//                                      .limit(rangeIntLimit+1)
                                     
//             :   orders = await Orders.find({"customer_id": filter.customer_id}, {__v: 0, _id: 0 })
//                                      .sort(-sort[0])
//                                      .limit(rangeIntLimit+1)
                
//             if (!orders) return res.status(404).json("Orders Not Found")
//             res.status(200).json(orders)
                                     
//         }

//     }

//     if(Object.keys(filter).length > 0 && filter.id){
    
//         console.log("Got here")
//         orders = await Orders.find().where("idx").in(filter.id)
//         if (!orders) return res.status(404).json("Invoice not Found")
//         console.log("[ORDERS - QUERY]", orders)

//         res.status(200).json(orders)
//     }
// }    