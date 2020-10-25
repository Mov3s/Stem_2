const express = require('express')
const router = express.Router()
const stripe = require('stripe')(process.env.SECRET_KEY)

const { check, validationResult } = require('express-validator');


// @route    POST api/confirm-payment-intent
// @desc     Confirm a payment Intent with Payment Method 
// @access   Private
router.post('/', 
  [
    check('intentId', 'payment intent id is required')
    .not()
    .isEmpty(),
    check('paymentMethod_Id', 'payment method id is required')
    .not()
    .isEmpty(),
  ],
   async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try{

        const { intentId, paymentMethod_Id } = req.body 

        const paymentIntent = await stripe.paymentIntents.update(
            intentId,
            {payment_method: paymentMethod_Id}
        );

        console.log('[UPDATEDINTENT]', paymentIntent)

        const payload = await stripe.paymentIntents.confirm(
            paymentIntent.id,
        );

        res.status(200).json({
          payload: payload.id,
        });

    }catch(e){
        res.status(400).json({error: e.message})
        console.log(e)
    }
});

module.exports = router