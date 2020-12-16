const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const { getNextSequence } = require('../../utils/myUtils')

const { check, validationResult } = require('express-validator');

const Customer = require('../../models/Customer');
const User = require('../../models/User')


// ******************ADMIN
// @route    GET api/customers
// @desc     Get all customers in db
// @access   Private - for admin
router.get('/', auth, async (req, res, next) => {

    try{

    var customers, header

    const filter = req.query.filter === undefined  || req.query.filter === '{}' ? {} : JSON.parse(req.query.filter)
    const range = req.query.range === undefined ? {} : JSON.parse(req.query.range)
    const sort = req.query.sort === undefined ? {} : JSON.parse(req.query.sort)

    // console.log("[CUSTOMER - DECODEDURL]", decodeURIComponent(req.url.replace(/\+/g, ' ')))

    if (Object.keys(req.query).length === 0) {

      customers = await Customer.find({},{date: 0, __v: 0, _id: 0})     

      if (!customers) return res.status(404).json("Products not Found")

      Customer.setContentLimit(res, header, range, customers)

    }else{

      if(range && sort){
        
            if (Object.keys(filter).length === 0){

                customers = await Customer.sort(sort, range)
                if (!customers) return res.status(404).json("Customer not found")
                // console.log("[CUSTOMER - SORT]", customers)
                Customer.setContentLimit(res, header, range, customers)

            }

            if (Object.keys(filter).length > 0 && filter.q){
            
                customers = await Customer.textSearch(filter, sort, range)
                if (!customers) return res.status(404).json("Customer not Found")
                // console.log("[CUSTOMER - QUERY]", customers)
                Customer.setContentLimit(res, header, range, customers)

            }
      }

      if(Object.keys(filter).length > 0 && filter.id){
            
        customers = await Customer.find().where("idx").in(filter.id)
        if (!customers) return res.status(404).json("Customer not Found")
        // console.log("[CUSTOMER - QUERY]", customers)
        return res.status(206).json(customers)
      }
    }

    }catch(e){
        console.log(e)
        res.status(500).json({"Error": e.message})
    }
})


// ******************ADMIN
// @route    GET api/customers/id
// @desc     Get customer by id 
// @access   Private - for admin
router.get('/:idx', auth, async (req, res, next) => {

    try{

       const customer = await Customer.findOne({"idx": req.params.idx}, { __v: 0, _id: 0})

       if (!customer || customer.length === 0) return res.status(404).json("Customer not found")

       res.status(200).json(customer)

    }catch(e){
        console.log(e)
        res.status(500).json({"Error":e.message})
    }
})


// @route    GET api/customers/my/address
// @desc     Get customer address for checkout  
// @access   Private - for registered users..
router.get('/my/address', auth, async (req, res, next) => {

    try{

       const customer = await Customer.findOne({"user_id": req.user.id}, { __v: 0, _id: 0})

       if (!customer || customer.length === 0) return res.status(404).json("Customer not found")

       const details = {
           address : customer.address ? customer.address : null,
           city : customer.city ? customer.city: null,
           eirCode : customer.eirCode ? customer.eirCode : null,
           country : customer.country ? customer.country : null,
           firstname : customer.firstname ? customer.firstname : null,
           lastname: customer.lastname ? customer.lastname : null
       }

       return res.status(200).json({ success: true, data: details })

    }catch(e){
       console.log(e)
       return res.status(500).json({ success: false, error : e.message })
    }
})



// @route    post api/customer
// @desc     Create customer
// @access   PrivateRoute - for customers
router.post('/', 
        [
            auth,
            [
                check('firstname', 'first name is required')
                .not()
                .isEmpty(),
                check('lastname', 'last name is required')
                .not()
                .isEmpty()
            ]
        ],
        async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{

        //get user by id, check if admin, if admin use seq to set id
        //else used req.user.id
        var newUserId 
        var newEmail

        const id = req.user.id

        const user = await User.findById(id)

        if (!user) return res.status(404).json("User doesn't exist")

        const seq = await getNextSequence(mongoose.connection.db, 'customerId')

        const { firstname, lastname, address, birthday, eirCode, groups, city, user_id, email, country } = req.body
        
        if(user.isAdmin === true){
            console.log("Admin Creating User")
            newUserId  =  user_id
            newEmail = email
            
        }else {
            newUserId = id
            newEmail = user.email
        }

        const customer = new Customer({
            idx: seq,
            user_id: newUserId,
            email: newEmail,
            lastname: lastname,
            firstname: firstname,
            address: address,
            birthday: birthday,
            country: country,
            eirCode: eirCode,
            groups: groups,
            city: city,
        })

        const newCustomer = await customer.save()

        return res.status(200).json(newCustomer)
    
    }catch(e){
        return res.status(500).json({"Error":"Something Went wrong"})
    }

})


//ADMIN
//@route     Update - PUT api/customers
// @desc     Creat customer
// @access   Private - for customers
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

        const { idx, firstname, lastname, address, email, birthday, eirCode, groups, city, newsletter, ordered, country } = req.body

        const userId = req.user.id

        let customer
        if (idx){
            customer = await Customer.findOne({"idx": idx}, {__v: 0})
        }else{
            customer =  await Customer.findOne({"user_id": userId}, {__v: 0})
        }

        if (!customer) return res.status(404).json("Customer doesnt exist")

        customer.lastname = lastname ? lastname : customer.lastname;
        customer.firstname = firstname ? firstname : customer.firstname;
        customer.address = address ? address : customer.address;
        customer.birthday = birthday ? birthday : customer.birthday;
        customer.country = country ? country : customer.country;
        customer.eirCode = eirCode ? eirCode : customer.eirCode;
        customer.groups = groups ? groups : customer.groups;
        customer.city = city ? city : customer.city;
        customer.email = email ? email : customer.email;
        customer.has_newsletter = newsletter ? newsletter : customer.has_newsletter
        customer.has_ordered = ordered ? ordered : customer.has_ordered;
        await customer.save()

        return res.status(200).json(customer)
    
    }catch(e){
        console.log(e)
        return res.status(500).json({"Error":e.message})
    }
})


//********** ADMIN ******/
// @route DELETE api/customers/:id
// @desc Delete single customer by Id 
// @access Private - for ADMIN
router.delete('/:idx', auth, async (req, res) => {
    
    try{
        const customer = await Customer.findOne({"idx": req.params.id})

        // req.params.id.match(/^[0-9a-fA-F]{24}$/) 
        if (!customer) {
             return res.status(404).json({ msg: 'customer not found' });
        }
        
        await customer.remove();
        res.json({"Message" : "Customer Deleted Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send({"Error":err.message})
    }
})


//********** ADMIN ******/
// @route api/customers - DELETE multiple customers by (query.filter) 
// @desc Delete multiple customers by Id 
// @access Private
router.delete('/', auth, async (req, res) => {
    
    try{

        const filter = req.query.filter ? JSON.parse(req.query.filter) : null

        const customers = await Customer.find({}, {_id: 0, __v:0}).where("idx").in(filter.id) 

        if (!customers) {
             return res.status(404).json({ msg: 'customers not found' });
        }

        await Customer.deleteMany({idx: { $in : filter.id}});
        res.status(200).json({"Message" : "Customers Deleted Deleted"})

    }catch(err){
        console.log(err);
        res.status(500).send(err.message)
    }
})


module.exports = router