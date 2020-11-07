const express = require('express')
const router = express.Router()
const stripe = require('stripe')(process.env.SECRET_KEY)

const { check, validationResult } = require('express-validator');
const { calculateOrderAmount } = require('./utils/myUtils')

// @route    POST api/create-payment-intent
// @desc     Revoke User Token 
// @access   Private
router.post('/', 
  // [
  //   check('price', 'price is required')
  //   .not()
  //   .isEmpty(),
  // ]
   async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{

        const { items, customer, currency } = req.body 

        const cost = await calculateOrderAmount(items)

        //accept multiple payment Methods
        const intent =  await stripe.paymentIntents.create({
            amount: cost,
            currency: currency, 
            payment_method_types: ['card'],
            receipt_email: 'isioma.chuck@gmail.com',
            // Verify your integration in this guide by including this parameter
            metadata: {integration_check: 'accept_a_payment'},
        });

        console.log('[INTENT]', intent)
        
        res.json({
          client_secret:  intent.client_secret,
          id: intent.id
        });

    }catch(e){
      console.log(e)
    }
});

module.exports = router