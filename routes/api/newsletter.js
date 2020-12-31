const express = require('express');
const router = express.Router();

const EmailsForNewsletter = require('../../models/EmailsForNewsletter')
const { check, validationResult } = require('express-validator');
const { getTransporter } = require('../../utils/transporter')


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

        const transporter = getTransporter()

        let message = {
            from: 'InphinityX <housesubletting@gmail.com>',
            to: email,
        
            // Subject of the message
            subject: 'Newsletter ✔ #', 

            html: "<p>Signed up for newsletter successfully</p>" +
                "<p>Thanks</p>"+
                "<p>The InphinityX Team</p>"
        }

        transporter.sendMail(message, (error, info) => {
            if (error) {
                console.log(error.message);
                // Logs.addLog(level.error, error.message, error.stack)
                return;
            }
            console.log('Server responded with "%s"', info.response);
            // Logs.addLog(level.info, `SMTP Server responded with ${info.response} for User - ${user.id}`, '')
            transporter.close();
        });
        
        return res.status(200).json({
            success: true,
            message: ''
        })

    }catch(e){
        // console.log(e)
        return res.status(500).json({error: e.message})
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