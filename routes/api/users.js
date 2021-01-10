const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mongoose = require('mongoose')

const { check, validationResult } = require('express-validator');

const auth = require('../../middleware/auth')

const User = require('../../models/User');
const Customer = require('../../models/Customer');
const UserService = require('../../middleware/user-service');
const { setTokenCookie, getNextSequence } = require('../../utils/myUtils')

const { asyncTransporter } = require('../../utils/transporter')


//@route   GET api/users
//@desc    Get all users in db.... info for Admin page 
//@access  Private
router.get('/', auth, async (req, res, next) => {

  try{
    const users = await User.find({}, {__v: 0, password: 0})

    if (!users){
      return res.status(404).json("No User(s) found")
    }

    res.status(200).json(users)

  }catch(err){

    res.status(500).json("Server Error")
  }
})


// @route    POST api/users
// @desc     Register user account
// @access   Public
router.post(
  '/',
  [
    check('email', 'Please include a valid email').isEmail(),
    check(
      'password',
      'Please enter a password with 6 or more characters'
    ).isLength({ min: 6 })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    // console.log(errors)
    if (!errors.isEmpty()) {
      return res.status(404).json({ errors: errors.array() });
    }

    try {

     const { email, password, password2 } = req.body;
     const ipaddress = req.ip
    //  console.log(req.body)

     UserService.registerUser({email, password, password2, ipaddress})
     .then( async ({refreshToken, jwtToken, ...user}) => {

      setTokenCookie(res, refreshToken)

      // console.log(user._id)

      const seq = await getNextSequence(mongoose.connection.db, 'customerId')
      console.log(seq)
      let customer = new Customer({
        idx: seq,
        email: user.email,
        user_id: user._id,
      })
      await customer.save()

      let signUpMessage = {
        from: `InphinityX <${process.env.GMAIL}>`,
        to: email,
    
        // Subject of the message
        subject: 'Welcome!!', 
        html: 
            '<html>' + 
                '<p>Hi,</p>' +
                '<p>Thank you for signing up to InPhinityX!</p>' +
                '<p>We are so delighted you have chosen to be part of the Family.</p>' +
                '<p>Don’t forget to sign up for the Newsletter and be the first to get new Discount Codes when they drop </p>'+
                '<p>Best</p>' +
                '<p>InphinityX</p>' +
            '</html>',
      }

      const signUpSent = await asyncTransporter(signUpMessage)

      if (signUpSent){
        console.log('Sign uP email sent')
      }

      return res.status(200).json({
        success: true,
        confirmationSent: signUpSent,
        user,
        jwtToken
      })
    }).catch((error) => {
      return res.status(400).json({
        error
      });
    })

    //   var user = await User.findOne({ email });

    //   if (user) {
    //     return res
    //       .status(400)
    //       .json({ errors: [{ msg: 'User already exists' }] });
    //   }

    //   user = new User({
    //     email,
    //     password,
    //     isAdmin : isAdmin ? isAdmin : false
    //   });

    //   const salt = await bcrypt.genSalt(10);

    //   user.password = await bcrypt.hash(password, salt);

    //   await user.save();

      // const payload = {
      //   user: {
      //     id: user.id
      //   }
      // };

      // jwt.sign(
      //   payload,
      //   config.get('jwtSecret'),
      //   { expiresIn: 360000 }, //1hour, "1h"
      //   (err, token) => {
      //     if (err) throw err;
      //     res.status(200).json({ token });
      //   }
      // );
    } catch (err) {
      // console.error(err);
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  }
);


module.exports = router;
