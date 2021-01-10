const express = require('express');
const router = express.Router();
require('dotenv').config();

const stripe = require('stripe')(process.env.SECRET_KEY)
const auth = require('../../middleware/auth');
const { check, validationResult } = require('express-validator');

const Customer = require('../../models/Customer') 
const User = require('../../models/User')
const CheckOutSession = require('../../models/CheckOutSession')
const Product = require('../../models/Product')
const Orders = require('../../models/Orders')

const { getTransporter, asyncTransporter, generateTable } = require('../../utils/transporter')
const { decrypt } = require('./utils/myUtils')

// const MYDOMAIN = 'http://localhost:3000';


//@route /api/confirm-session
//@desc confirm checkout session that was completed
//@access private
router.post('/', 
  auth,
  [
    check('sessionId', 'sessionId is required')
    .not()
    .isEmpty()
  ],
async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{
        const { sessionId } = req.body

        const decryptedSessId = decrypt(sessionId)

        const user = await User.findById(req.user.id)

        if (!user){
            return res.status(404).json({ success: false, message: 'Invalid User'})
        }

        const chkSession = await CheckOutSession.findOne({ 
            $and: [
                {
                    user: user._id
                },
                {
                    sessionId : decryptedSessId
                }
             ]
         })

        if (!chkSession) return res.status(404).json({ success: false, message: 'Invalid Session'})

        // if (chkSession.completed === true){
        //     return res.status(400).json({ success: false, message: 'Finished Session'})
        // }

        const mSession = await stripe.checkout.sessions.retrieve(
            chkSession.sessionId
        );

        if(!mSession){
            return res.status(404).json({ success: false, message: 'Stripe : Invalid Session'})
        }

        let stripeCustomer = await stripe.customers.list({
            email: user.email,
            limit: 1
        })

        const customer = await Customer.findOne({ user_id: user._id})

        await stripe.customers.update(stripeCustomer.data[0].id,
            {
                metadata: { 
                    externalId: customer && customer.idx,
                    lastSession: mSession.id,
                    firstname: customer.firstname,
                    lastname: customer.lastname,
                    phonenumber: customer && customer.phonenumber 
                }
            }
        )

        const order = await Orders.findOne({ idx: chkSession.order_id })

        //get payment intent id from mSession, send that link to Owner to view details of order - replace static intent with value gotten from session
        //from payment she can view customer address and view the customer to see phone number on metadata
        //note she'll be prompted to sign in
        ///https://dashboard.stripe.com/test/payments/{pi_1I6szoBlvQTC5cs5XiVorhad}

        let basket = []

        for(let item of order.basket){
            const product = await Product.findOne({ idx: item.product })

            if (!product){
                //******************************************** */
                console.log("invalid product, not found")
            }

            const productWImages = await Product.GetThumbnails(product)

            let basketItem = {
                name : product.name,
                price: product.price,
                image: productWImages[0].base64, //get product Image and display ''
                quantity: item.quantity
            }
            basket.push(basketItem)
        }

        if (mSession.payment_status === "paid"){

            order.status = mSession.payment_status ? mSession.payment_status : order.status

            customer.city = mSession.shipping.address.city
            customer.country = mSession.shipping.address.country
            customer.address = `${mSession.shipping.address.line1}, ${mSession.shipping.address.line2}, ${mSession.shipping.address.state}`
            customer.eirCode = mSession.shipping.address.postal_code

            await customer.save()

            await order.save()

            let emailSent = chkSession.completed
            if (chkSession.completed === true){ //***Chnage to false */******************************* */

                const {line1, line2, state, city, country, postal_code } =  mSession.shipping.address

                const messageTable = generateTable(basket)

                let message = {
                    from: `InphinityX <${process.env.GMAIL}>`,
                    to: user.email,
                
                    // Subject of the message
                    subject: `Order Confirmation ✔ #${order.reference}`, 
                
                    html: '<!DOCTYPE html>'+
                   " <html>"+
                    '<div style="display:block;background-color:rgba(219, 246, 206, 0.5);">'+
                            `<b>Hi,</b>`+ 
                            `<p>You have supported a small business</p>` +
                            `<p>Thank you for your recent order. We are getting your order ready to be shipped and will notify you when it has been sent.</p>`+ 
                            "<b>IT'S ORDERED!!</b>" + 
                            "<p>Please find the details of your order below:"+
                        
                            `<div style="display:flex;justify-content:center;align-items:center;"><b>Order Details</b></div>` +
                            `<div style="text-align:left;"> `+
                                `<p>Order reference: #<b>${order.reference}</b></p>`+
                                `<p>Order date: ${order.createdAt}</p>`+
                                `<p>Estimated Delivery date: 2 - 5 Business days</p>`+
                            `</div>`+
                            "<div>" +
                                `<b>Delivery details</b>`+
                                `<div>`+
                                    `<p>${customer.firstname + ' ' + customer.lastname}</p>`+
                                    `<p>${line1 }</p>`+
                                    `<p>${line2 }</p>`+
                                    `<p>${city }</p>`+
                                    `<p>${postal_code + ' ' + state + ' ' + country }</p>`+
                                `</div>`+
                                `<p>${customer.phonenumber}</p>`+
                            "</div>"+ 
                            "<div>"+
                                `${messageTable}`+
                            "</div>"+
                            `<p>Best Regards,</p>` +
                            `<p>InphinityX</p>` +
                    `</div>`+
                    "</html>",
                            // '<div style="display:flex;justify-content:center;align-items:center;"><img src="cid:logo" alt="InphintyX logo." width="100" height="70" style="display: block;"/></div>'+
                    //     attachments: [{
                    //         filename: 'Logo.png',
                    //         path: './img/Logo.png',//__dirname +
                    //         cid: 'logo' //my mistake was putting "cid:logo@cid" here! 
                    //    }]
                }

                let adminMessage = {
                    from: `InphinityX <${process.env.GMAIL}>`,
                    to: process.env.GMAIL,
                
                    // Subject of the message
                    subject: `Order Placed ✔ #${order.reference}`, 
                    html: 
                        '<html>' + 
                            '<div>' +
                                '<p> An order has been placed on the IphinityX webstore. Please check stripe to check for more details </p>' +
                                `<a href="https://dashboard.stripe.com/payments/${order.stripe_payment_intent}"> View Order </a>`+
                            '</div>' +
                            '<div>' +
                                '<p>Best</p>' +
                                '<p>InphinityX</p>' +
                            '</div>' +
                        '</html>',
                }

                var emailOwner = await asyncTransporter(adminMessage)

                if (emailOwner){
                    console.log("Email sent to Owner: ", emailOwner)
                }
                
                emailSent = await asyncTransporter(message)

                chkSession.completed = emailSent

                await chkSession.save()
            }

            return res.status(200).json({ 
                success: true, 
                emailed: emailSent,
                status: mSession.payment_status,
                guest: false,
                orderDetails: {
                    reference: order.reference,
                    date: order.createdAt
                },
                customer: { 
                    firstname: customer.firstname,
                    lastname: customer.lastname,
                    email: user.email,
                    phonenumber: customer.phonenumber,
                },
                shipping: mSession.shipping,
                shippingFee: order.delivery_fee > 0 ? order.delivery_fee : 0,
                basket: basket
            })
        }else{
            return res.status(200).json({ 
                success: false, 
                status: mSession.payment_status
             });
        }

    }catch(e){
        console.log(e)
        return res.status(500).json({ 
          success: false,
          message: e.message
        })
    }
  });



//@route /api/confirm-session/guest
//@desc confirm checkout session that was completed
//@access public
router.post('/guest', 
//   auth,
  [
    check('sessionId', 'sessionId is required')
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
        const { email, sessionId } = req.body

        const decryptedSessId = decrypt(sessionId)

        const chkSession = await CheckOutSession.findOne({ 
            $and: [
                {
                    user: email
                },
                {
                    sessionId : decryptedSessId
                }
             ]
        })

        if (!chkSession) return res.status(404).json({ success: false, message: 'Invalid Session'})

        // if (chkSession.completed === true){
        //     return res.status(400).json({ success: false, message: 'Finished Session'})
        // }

        const mSession = await stripe.checkout.sessions.retrieve(
            chkSession.sessionId
        );

        if(!mSession){
            return res.status(404).json({ success: false, message: 'Stripe : Invalid Session'})
        }

        let stripeCustomer = await stripe.customers.list({
            email: chkSession.user,
            limit: 1
        })

        let updatedCustomer
        if (!stripeCustomer.data[0].metadata.firstname){
            updatedCustomer = await stripe.customers.update(stripeCustomer.data[0].id,
                {
                    metadata: { 
                        lastSession: mSession.id,
                        phonenumber: mSession.metadata.phonenumber,
                        firstname: mSession.metadata.firstname,
                        lastname: mSession.metadata.lastname
                    }
                }
            )
        }
       
        const order = await Orders.findOne({ idx: chkSession.order_id })

        //get payment intent id from mSession, send that link to Owner to view details of order - replace static intent with value gotten from session
        //from payment she can view customer address and view the customer to see phone number on metadata
        //note she'll be prompted to sign in
        ///https://dashboard.stripe.com/test/payments/{pi_1I6szoBlvQTC5cs5XiVorhad}

        let basket = []

        for(let item of order.basket){
            const product = await Product.findOne({ idx: item.product })

            if (!product){
                console.log("invalid product, not found")
            }

            const productWImages = await Product.GetThumbnails(product)

            let basketItem = {
                name : product.name,
                price: product.price,
                image: productWImages[0].base64, //get product Image and display ''
                quantity: item.quantity
            }

            basket.push(basketItem)

        }

        //guest customer 
        const customerDTO = {
            phonenumber: updatedCustomer ? updatedCustomer.metadata.phonenumber : stripeCustomer.data[0].metadata.phonenumber ,
            firstname: updatedCustomer ? updatedCustomer.metadata.firstname : stripeCustomer.data[0].metadata.firstname ,
            lastname: updatedCustomer ? updatedCustomer.metadata.lastname : stripeCustomer.data[0].metadata.lastname,
            email: email
        }

        if (mSession.payment_status === "paid"){

            order.status = mSession.payment_status ? mSession.payment_status : order.status

            chkSession.stripeuser = (updatedCustomer && updatedCustomer.id) ? updatedCustomer.id : stripeCustomer.data[0].id

            await order.save()

            let emailSent = chkSession.completed
            
            if (chkSession.completed === false){

                const {line1, line2, state, city, country, postal_code } =  mSession.shipping.address

                const messageTable = generateTable(basket)

                let message = {
                    from: `InphinityX <${process.env.GMAIL}>`,
                    to: chkSession.user,
                
                    // Subject of the message
                    subject: `Order Confirmation ✔ #${order.reference}`, 
                
                    html: '<!DOCTYPE html>'+
                   " <html>"+
                    '<div style="display:block;background-color:rgba(219, 246, 206, 0.5);">'+
                            `<b>Hi,</b>`+ 
                            `<p>You have supported a small business</p>` +
                            `<p>Thank you for your recent order. We are getting your order ready to be shipped and will notify you when it has been sent.</p>`+ 
                            `<p>Best,</p>` +
                            `<p>InphinityX</p>` +
                            "<b>IT'S ORDERED!!</b>" + 
                            "<p>Please find the details of your order below:"+
                        
                            `<div style="display:flex;justify-content:center;align-items:center;"><b>Order Details</b></div>` +
                            `<div style="text-align:left;"> `+
                                `<p>Order reference: #<b>${order.reference}</b></p>`+
                                `<p>Order date: ${order.createdAt}</p>`+
                                `<p>Estimated Delivery date: 2 - 5 Business days</p>`+
                            `</div>`+
                            "<div>" +
                                `<b>Delivery details</b>`+
                                `<div>`+
                                    `<p>${customerDTO.firstname + ' ' + customerDTO.lastname}</p>`+
                                    `<p>${line1 }</p>`+
                                    `<p>${line2 }</p>`+
                                    `<p>${city }</p>`+
                                    `<p>${postal_code + ' ' + state + ' ' + country }</p>`+
                                `</div>`+
                                `<p>${customerDTO.phonenumber}</p>`+
                            "</div>"+ 
                            "<div>"+
                                `${messageTable}`+
                            "</div>"+
                    `</div>`+
                    "</html>",
                }

                let adminMessage = {
                    from: `InphinityX <${process.env.GMAIL}>`,
                    to: process.env.GMAIL,
                
                    // Subject of the message
                    subject: `Order Placed ✔ #${order.reference}`, 
                    html: 
                        '<html>' + 
                            '<div>' +
                                '<p> An order has been placed on the IphinityX webstore. Please check stripe to check for more details </p>' +
                                `<a href="https://dashboard.stripe.com/payments/${order.stripe_payment_intent}"> View Order </a>`+
                            '</div>' +
                            '<div>' +
                                '<p>Best</p>' +
                                '<p>InphinityX</p>' +
                            '</div>' +
                        '</html>',
                }

                var emailOwner = await asyncTransporter(adminMessage)

                if (emailOwner){
                    console.log("Email sent to Owner: ", emailOwner)
                }
                
                emailSent = await asyncTransporter(message)

                chkSession.completed = emailSent

                await chkSession.save()
            }
            
            // const customerDTO = {
            //     phonenumber: updatedCustomer ? updatedCustomer.metadata.phonenumber : stripeCustomer.data[0].metadata.phonenumber ,
            //     firstname: updatedCustomer ? updatedCustomer.metadata.firstname : stripeCustomer.data[0].metadata.firstname ,
            //     lastname: updatedCustomer ? updatedCustomer.metadata.lastname : stripeCustomer.data[0].metadata.lastname,
            //     email: email
            // }

            return res.status(200).json({ 
                success: true,
                emailed: emailSent,
                status: mSession.payment_status, 
                guest: true,
                orderDetails: { 
                   reference: order.reference,
                   date: order.createdAt
                },
                customer: customerDTO,
                shipping: mSession.shipping,
                shippingFee: order.delivery_fee > 0 ? order.delivery_fee : 0,
                basket: basket,
            })
        }else{
            return res.status(200).json({ success: false, status: mSession.payment_status });
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
