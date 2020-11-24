const express = require('express');
const router = express.Router();

const EmailsForNewsletter = require('../../models/EmailsForNewsletter')
const { check, validationResult } = require('express-validator');


// @route    POST api/newsletter
// @desc     add emails for newsletter
// @access   Public
router.post('/',   
    [
        check('email').isEmail()
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