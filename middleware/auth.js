const jwt = require('jsonwebtoken');
const config = require('config');
const passport = require('passport');

const User = require('../models/User')
const RefreshToken = require('../models/RefreshToken')

const Logs =  require('../models/Logs')
const level = require('../utils/LogLevel')
require('dotenv').config()

const { decrypt } = require('../routes/stripe/utils/myUtils')

const auth = async (req, res, next) => {
  const secret = process.env.JWTSECRET

  // Get token string from header
  var token = req.header('Authorization') ? req.header('Authorization').split(' ')[1] : req.header('x-auth-token');

  // Check if not token
  if (!token || token === null) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  //verifytoken with jsonwebtoken
  try {

        const decryptedToken = decrypt(token)
        await jwt.verify(decryptedToken, secret, async (error, decoded) => {
            if(error){

              if (error.message === 'jwt expired'){
                Logs.addLog(level.level.error, error.name + ': '+error.message, error.stack)
                return res.status(401).json({ success: false, msg: error.message });
              }

              if (error.message === 'invalid signature'){
                Logs.addLog(level.level.error, error.name + ': '+error.message, error.stack)
                return res.status(401).json({ success: false, msg: 'Invalid Authorization Token' });
              }

              Logs.addLog(level.level.error, error.name + ': '+error.message, error.stack)
              return res.status(401).json({ success: false, msg: 'Invalid Authorization Token' });

            }
            
            req.user = {}
            req.user.id = decoded.id
        
            const user = await User.findById(req.user.id)

            if (!user){
              Logs.addLog(level.level.error, `User - ${req.user.id} doesn't exist`, error.message)
              return res.status(401).json({ msg: 'User not found' })
            }else{
              // req.user.isAdmin = user.isAdmin ? user.isAdmin : false
              const refreshToken = RefreshToken.find({user: user._id})
              req.user.ownsToken = token => !!refreshToken.find(x => x.token === token);

              Logs.addLog(level.level.info, `User AUTHENTICATED: Idx - ${ user.idx }`, '')
            }

            next();
        });

  } catch (error) {
    //Authentication failed
    Logs.addLog(level.error, error.message, error)
    return res.status(500).json({ msg: error.message });
  }

}


module.exports = auth