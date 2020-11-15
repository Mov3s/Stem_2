const jwt = require('jsonwebtoken');
const config = require('config');
const passport = require('passport');

const User = require('../models/User')
const RefreshToken = require('../models/RefreshToken')

const Logs =  require('../models/Logs')
const level = require('../utils/LogLevel')

const auth = async (req, res, next) => {
  const secret = config.get('jwtSecret')

  // Get token string from header
  var token = req.header('Authorization') ? req.header('Authorization').split(' ')[1] : req.header('x-auth-token');

  // Check if not token
  if (!token || token === null) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  //verifytoken with jsonwebtoken
  try {
        await jwt.verify(token, secret, (error, decoded) => {
            if(error){

              if (error.message === 'jwt expired'){
                Logs.addLog(level.error, error.message, error)
                return res.status(401).json({ msg: error.message });
              }

              Logs.addLog(level.error, error.message, error)
              return res.status(401).json({ msg: 'Invalid Authorization Token' });
            }
            
            req.user = {}
            req.user.id = decoded.id
        
            const user =  User.findById(req.user.id)

            if (!user){
              Logs.addLog(level.error, "UNAUTHORIZED ACCESS", error.message)
              return res.status(401).json({message: err.message})
            }else{
              // req.user.isAdmin = user.isAdmin ? user.isAdmin : false
              const refreshToken = RefreshToken.find({user: user._id})
              req.user.ownsToken = token => !!refreshToken.find(x => x.token === token);
              Logs.addLog(level.info, `USER - ${ user.id } AUTHENTICATED`, '')
            }

            next();
        });

  } catch (error) {
    //Authentication failed
    Logs.addLog(level.error, error.message, error)
    return res.status(500).json({ msg: err.message });
  }

}


module.exports = auth