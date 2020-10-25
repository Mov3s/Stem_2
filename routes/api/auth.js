const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../../middleware/auth');
const jwt = require('jsonwebtoken')
const config = require('config');
const { check, validationResult } = require('express-validator');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const UserService = require('../../middleware/user-service');
const { setTokenCookie, setJWTHeader } = require('../../utils/myUtils')

const secret = config.get('jwtSecret')

// @route    GET api/auth
// @desc     Test route (Get current user without password)
// @access   Public
router.get('/', auth, async (req, res, next) => {
  try {

    const user = await User.findById(req.user.id, {__v: 0, date: 0, password: 0})
    res.json(user);
  } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/auth
// @desc     Authenticate user & get token(LOGIN)
// @access   Public
router.post(
  '/',
  [
    check('username', 'Please include a valid Email').isEmail(),
    check('password', 'Password is required').isLength({min: 6})    
  ],
  async (req, res, next) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), });
    }

    const { username, password } = req.body;
    const ipaddress = req.ip

    try {

      UserService.authenticate({username, password, ipaddress})
      .then(({refreshToken, jwtToken, ...user}) => {
        setTokenCookie(res, refreshToken)
        res.status(200).json({
          user,
          jwtToken
        })
      }).catch(next)

    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);


// @route    POST api/auth/refreshtoekn
// @desc     Refresh User Token 
// @access   Public
router.post('/refresh-token', async (req, res, next) => {
    
    const token = req.cookies.refreshToken;
    const ipaddress = req.ip

    try {

      const refreshToken = await UserService.getRefreshToken(token);

      const { user } = refreshToken; //user_id

      // replace old refresh token with a new one and save
      const newRefreshToken = UserService.generateRefreshToken(user, ipaddress);
      // console.log(newRefreshToken)
      refreshToken.revoked = Date.now();
      refreshToken.revokedByIp = ipaddress;
      refreshToken.replacedByToken = newRefreshToken.token;
      await refreshToken.save();
      await newRefreshToken.save();

      // generate new jwt
      const jwtToken = UserService.generateJwtToken(user);

      setTokenCookie(res, newRefreshToken.token);
      // setJWTHeader(res, jwtToken);

      // return basic details and tokens
      res.status(200).json({
          ...UserService.basicDetails(user),
           jwtToken, //remove from response
           oldrefreshToken: refreshToken.token, //remove from response
           newrefreshToken: newRefreshToken.token //remove from response
      })

    } catch (err) {
      console.error(err);
      res.status(500).send(err.message);
    }
  }
);


// @route    POST api/auth/revoke-token
// @desc     Revoke User Token 
// @access   Private
router.post('/revoke-token', auth, async (req, res, next) => {
    
    const token = req.cookies.refreshToken || req.body.token;
    const ipaddress = req.ip

    if(!token){
      return res.status(404).json("Token is required")
    }

    try {
        const refreshToken = await UserService.getRefreshToken(token);

        // revoke token and save
        console.log("[BEFRORE]", refreshToken)
        refreshToken.revoked = Date.now();
        refreshToken.revokedByIp = ipaddress;
        await refreshToken.save();

        console.log("[AFTER]", refreshToken)

        res.status(200).json({ message: 'Token revoked' })
    }catch(e){
        console.log("[ERROR REVOKING TOKEN]", err )
        res.status(500).json({ message: e.message })
    }

  }
);

module.exports = router;



