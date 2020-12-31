const nodemailer = require("nodemailer")
const bunyan = require('bunyan');

let logger = bunyan.createLogger({
  name: 'nodemailer'
});

logger.level('trace');

const getTransporter = () => {

  var transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        type: 'OAuth2',
        user: process.env.GMAIL, //'housesubletting@gmail.com',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        accessToken: process.env.GOOGLE_ACCESS_TOKEN,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        expires: 1484314697598
    },
    // logger, 
    // debug: true
  });

  transporter.verify(function(error, success) {
    if (error) {
      console.log(error.message);
    } else {
      console.log("Server is ready to take our messages");
    }
  });

  console.log('SMTP configured')
  return transporter
}

module.exports = {
    getTransporter
};