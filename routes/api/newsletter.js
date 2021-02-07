const express = require('express');
const router = express.Router();

const EmailsForNewsletter = require('../../models/EmailsForNewsletter')
const { check, validationResult } = require('express-validator');

const { asyncTransporter } = require('../../utils/transporter')


// @route    POST api/newsletter
// @desc     add emails for newsletter
// @access   Public
router.post('/',   
    [
        check('email', 'email is invalid')
        .isEmail()
     ],
    async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
        
    try{
        const { email } = req.body

        // console.log(req.body)
        const _emailForNews = await EmailsForNewsletter.findOne({ email: email})

        if (_emailForNews) return res.status(400).json({ subscribed: true })

        const toSave = EmailsForNewsletter({
            email: email
        })

        await toSave.save()

        let message = {
            from: `InphinityX <${process.env.GMAIL}>`,
            to: email,
        
            // Subject of the message
            subject: 'Thank you for signing up to the InPhinityX Newsletter', 

            html: "<p>Hi,</p>" +
                "<p>Thanks for signing up to InPhinityX Newsletter!</p>"+
                "<p>We are so delighted you have chosen to be part of the Family, to say thank you see your special discount code below.</p>" +
                "<p><b>USE CODE: INPXNEW10</b> to get <b>10% OFF</b> your First Order.</p>" +
                "<p>Keep your eyes peeled for our special discount codes delivered to your email from time to time.</p>"+
                "<p>Warm hugs</p>"+
                "<p>The InphinityX Team</p>"
        }

        const newLetterSent = await asyncTransporter(message)
        
        return res.status(200).json({
            success: true,
            message: '', 
            confirmationSent: newLetterSent
        })

    }catch(e){
        // console.log(e)
        return res.status(500).json({
            success: false,
            error: e.message
        })
    }
})

// @route    GET api/newsletter
// @desc     Get all emails for newsletter
// @access   Public
router.get('/', async (req, res, next) => {
    try {
  
      const newsletter = await EmailsForNewsletter.find({}, {__v: 0, date: 0, password: 0})
      res.status(200).json(newsletter);
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: e.message });
    }
});
  
module.exports = router