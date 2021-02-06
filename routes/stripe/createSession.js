const express = require('express');
const router = express.Router();
require('dotenv').config();

const stripe = require('stripe')(process.env.SECRET_KEY)
const bcrypt = require('bcryptjs');
const auth = require('../../middleware/auth');
const jwt = require('jsonwebtoken')
const { check, validationResult } = require('express-validator');
const mongoose = require('mongoose')

const Customer = require('../../models/Customer') 
const User = require('../../models/User')
const CheckOutSession = require('../../models/CheckOutSession')

const { calculateOrderAmount,
        getPriceForProduct, 
        getShipping, 
        randomString,
        // getShippingPrice
      } = require('./utils/myUtils');


const { getNextSequence } = require('../../utils/myUtils')

const Orders = require('../../models/Orders');

// const MYDOMAIN = 'http://localhost:3000';


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
        const { items, details } = req.body

        console.log(details)

        const MYDOMAIN = process.env.CLIENT_URL

        // console.log(req.user.ownsToken())
        const mCustomer = await Customer.find({ user_id: req.user.id})

        if (!mCustomer || mCustomer.length === 0){
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

        const { lineitems, excludeShipping, total } = await getPriceForProduct(items)

        let deliveryFee, orderTotal

        if (!excludeShipping){
          const shippingId = process.env.SHIPPING_ID

          const { line, price } = await getShipping(shippingId)

          deliveryFee = price
          lineitems.push(line)

          orderTotal = total
          orderTotal += price

        }else{
          orderTotal = total
        }
    
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
            allowed_countries: ['IE'],
          },
        });

        //saving to new model, to retrieve session info later
        //begin
       

        const orderId = await getNextSequence(mongoose.connection.db, 'orderId')

        const checkout = new CheckOutSession({
          sessionId: session.id,
          user: req.user.id,
          stripeuser: stripeCustomer.data[0].id,
          order_id: orderId
        })

        const user = await User.findById(req.user.id)

        const order = new Orders({
          idx: orderId,
          customer_id: mCustomer[0].idx,
          reference: randomString(10),
          status: 'ordered',
          basket: items,
          total: orderTotal,
          delivery_fee: deliveryFee ? deliveryFee : 0,
          total_exc_taxes: orderTotal,
          stripe_email: user.email,
          stripe_payment_intent: session.payment_intent
        })

        mCustomer[0].has_ordered = true

        await mCustomer[0].save()

        await order.save()

        await checkout.save()
        //end

        await stripe.customers.update(
          stripeCustomer.data[0].id,
          {
          metadata: { 
            lastSession: session.id,
            phonenumber: details.phonenumber
          }
        })

        return res.status(200).json({ 
          success: true, 
          id: session.id 
        });

    }catch(e){
        console.log(e)
        return res.status(500).json({ 
          success: false,
          message: e.message
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
        const {items, email, details} = req.body

        let customers = await stripe.customers.list({
          email: email.toString(),
        })

        //Use orders in confrim to update the values and shit 

        const MYDOMAIN = process.env.CLIENT_URL

        // console.log('[GUEST]', customers)
        const { lineitems, excludeShipping, total } = await getPriceForProduct(items)

        let deliveryFee, orderTotal

        if (!excludeShipping){
          const shippingId = process.env.SHIPPING_ID

          const { line, price } = await getShipping(shippingId)

          deliveryFee = price
          lineitems.push(line)

          orderTotal = total
          orderTotal += price

        }else{
          orderTotal = total
        }

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
              allowed_countries: ['IE'],
            },
            metadata: { 
              phonenumber: details.phonenumber,
              firstname: details.firstname,
              lastname: details.lastname,
            }
          });

          //saving to new model, to retrieve session info later
          //begin

          const orderId = await getNextSequence(mongoose.connection.db, 'orderId')

          const checkout = new CheckOutSession({
            sessionId: session.id,
            user: email.toString(),
            order_id: orderId
           // stripeuser: stripeCustomer.data[0].id
          })

          const order = new Orders({
            idx: orderId,
            reference: randomString(10),
            status: 'ordered',
            basket: items,
            total: orderTotal,
            delivery_fee: deliveryFee ? deliveryFee : 0,
            total_exc_taxes: orderTotal,
            stripe_email: email.toString(),
            stripe_payment_intent: session.payment_intent,
            stripe_session_id: session.id
          })

          await order.save()

          await checkout.save()
          //end

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
              allowed_countries: ['IE'],
            },
          });

          //saving to new model, to retrieve session info later
          //begin

          const orderId = await getNextSequence(mongoose.connection.db, 'orderId')

          const checkout = new CheckOutSession({
            sessionId: session.id,
            user: customers.data[0].email,
            stripeuser: customers.data[0].id,
            order_id: orderId,
          })

          const order = new Orders({
            idx: orderId,
            reference: randomString(10),
            status: 'ordered',
            basket: items,
            total: orderTotal,
            delivery_fee: deliveryFee ? deliveryFee : 0,
            total_exc_taxes: orderTotal,
            stripe_email: email.toString(),
            stripe_payment_intent: session.payment_intent,
            stripe_session_id: session.id
          })

          await order.save()

          await checkout.save()
          //end

          await stripe.customers.update(
            customers.data[0].id,
            {
              metadata: { 
                lastSession: session.id,
                phonenumber: details.phonenumber,
                firstname: details.firstname,
                lastname: details.lastname,
              }
            }
          )

          return res.status(200).json({"success": true, id: session.id });
       }

    }catch(e){
        console.log(e)
        return res.status(500).json({ 
          success: false,
          message: e.message
        })
    }
  });



module.exports = router