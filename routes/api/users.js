const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');

const { check, validationResult } = require('express-validator');

const auth = require('../../middleware/auth')

const User = require('../../models/User');

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
// @desc     Register user
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, isAdmin } = req.body;

    try {
      var user = await User.findOne({ email });

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] });
      }

      user = new User({
        email,
        password,
        isAdmin : isAdmin ? isAdmin : false
      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        config.get('jwtSecret'),
        { expiresIn: 360000 }, //1hour, "1h"
        (err, token) => {
          if (err) throw err;
          res.status(200).json({ token });
        }
      );
    } catch (err) {
      console.error(err);
      return res.status(500).send({'err': err.message});
    }
  }
);


module.exports = router;
