const express = require('express');
const router = express.Router();

const EmailsForNewsletter = require('../../models/EmailsForNewsletter')
const { check, validationResult } = require('express-validator');


// @route    POST api/newsletter
// @desc     add emails for newsletter
// @access   Public
router.post('/',   
    [
        check('email', 'Please include a valid email').isEmail()
    ], async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
        
    try{
        const { email } = req.body

        const toSave = EmailsForNewsletter({
            email: email
        })

        await toSave.save()

        return res.status(200).json({success: true})

    }catch(e){
        // console.log(e)
        return res.status(500).json({error: e.message})
    }
})

module.exports =  router