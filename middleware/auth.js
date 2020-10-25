const jwt = require('jsonwebtoken');
const config = require('config');
const passport = require('passport');

const User = require('../models/User')
const RefreshToken = require('../models/RefreshToken')


const auth = async (req, res, next) => {
  const secret = config.get('jwtSecret')

  // Get token string from header
  var token = req.header('Authorization') ? req.header('Authorization').split(' ')[1]: req.header('x-auth-token');

  // Check if not token
  if (!token || token === null) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  console.log("[REMOVED_BEARER_TO_VERIFY]👉🏾👉🏾", "AUTH")

  //verifytoken with jsonwebtoken
  try {
        await jwt.verify(token, secret, (error, decoded) => {
            if(error){

              if (error.message === 'jwt expired'){
                return res.status(401).json({ msg: 'Expired Token, Sign in Again' });
              }

              console.log("[ERROR WITH VERIFYING TOKEN - AAUTH]", error)
              return res.status(401).json({ msg: 'Invalid Authorization Token' });
            }
            
            req.user = {}
            req.user.id = decoded.id
        
            const user =  User.findById(req.user.id)

            if (!user){
              return res.status(401).json({message: 'Unauthorized'})
            }else{
              // req.user.isAdmin = user.isAdmin ? user.isAdmin : false
              const refreshToken = RefreshToken.find({user: user._id})
              req.user.ownsToken = token => !!refreshToken.find(x => x.token === token);
            }

            next();
          
        });

  } catch (err) {
    console.error("[AUTH-MIDDLEWARE-ERROR]", err)
    res.status(500).json({ msg: err.message });
  }

}


module.exports = auth