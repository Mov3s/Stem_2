const express = require('express');
const router = express.Router();
require('dotenv').config();

const stripe = require('stripe')(process.env.SECRET_KEY)
const bcrypt = require('bcryptjs');
const auth = require('../../middleware/auth');
const jwt = require('jsonwebtoken')
const { check, validationResult } = require('express-validator');

const Customer = require('../../models/Customer') 
const User = require('../../models/User')

const { calculateOrderAmount, getPriceForProduct } = require('./utils/myUtils')
const MYDOMAIN = 'http://localhost:3000';


//@route /api/create-session
//@desc custom pre-built checkout for stripen
//@access public
router.post('/', 
  auth,
  [
    check('items', 'price is required')
    .not()
    .isEmpty(),
  ],
async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{
        const { items, shippingAddress } = req.body

        // console.log(req.user.ownsToken())
        const mCustomer = await Customer.find({ user_id: req.user.id})

        if (mCustomer.length === 0){
          return res.status(404).json({error: 'Customer Not Found'})
        }

        let stripeCustomer = await stripe.customers.list({
          email: mCustomer[0].email,
          limit: 1
        })

        if (stripeCustomer.data.length === 0){
          stripeCustomer = await stripe.customers.create({
            email: mCustomer[0].email.toString(),
            name: `${mCustomer[0].firstname} ${mCustomer[0].lastname}`,
          })
        }

        const lineitems = await getPriceForProduct(items)
        console.log(lineitems)

        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomer.data[0].id,
          payment_method_types: ['card'],
          line_items: lineitems,
          mode: 'payment',
          allow_promotion_codes: true,
          success_url: `${MYDOMAIN}/checkout?success=true`,
          cancel_url: `${MYDOMAIN}/checkout?canceled=true`,
          metadata: { 
            externalIdx: mCustomer[0].idx 
          },
          billing_address_collection: 'auto',
          shipping_address_collection: {
            allowed_countries: ['IE', 'GB'],
          },
        });

        console.log(stripeCustomer.data[0].metadata.lastSession)
        const customermeta = stripeCustomer.data[0].metadata

        await stripe.customers.update(
          stripeCustomer.data[0].id,
          {
          metadata: { 
            lastSession: session.id
          }
        })

        return res.status(200).json({ "success": true, id: session.id });
    }catch(e){
        console.log(e)
        return res.status(500).json({ 
          "success": false,
          "message": e.message
        })
    }
  });


//@route /api/create-session/guest
//@desc custom pre-built guest checkout for stripe
//@access public
router.post('/guest',
[
  check('items', 'items are required')
  .not()
  .isEmpty(),
  check('email', 'email is required')
  .not()
  .isEmpty(),
],
async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{
        const {items, email} = req.body
        let customers = await stripe.customers.list({
          email: email.toString(),
        })

        console.log('[GUEST]', customers)
        const lineitems = await getPriceForProduct(items)

        console.log(lineitems)

        if (customers.data.length === 0){
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineitems,
            mode: 'payment',
            success_url: `${MYDOMAIN}/checkout?success=true`,
            cancel_url: `${MYDOMAIN}/checkout?canceled=true`,
            customer_email : email.toString(),
            billing_address_collection: 'auto',
            allow_promotion_codes: true,
            shipping_address_collection: {
              allowed_countries: ['IE', 'GB'],
            },
          });
          return res.status(200).json({ "success": true, id: session.id });

        }else{
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineitems,
            mode: 'payment',
            success_url: `${MYDOMAIN}/checkout?success=true`,
            cancel_url: `${MYDOMAIN}/checkout?canceled=true`,
            customer : customers.data[0].id,
            billing_address_collection: 'auto',
            allow_promotion_codes: true,
            shipping_address_collection: {
              allowed_countries: ['IE', 'GB'],
            },
          });
          return res.status(200).json({"success": true, id: session.id });
        }
    }catch(e){
        console.log(e)
        return res.status(500).json({ 
          "success": false,
          "message": e.message
        })
    }
  });

module.exports = router