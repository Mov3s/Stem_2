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

const asyncTransporter = (mailOptions) => {
  return new Promise((resolve, reject) => {

    const transporter = getTransporter()
          
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error.message);
          resolve(false); 
        }else {
          console.log('Server responded with "%s"', info.response);
          console.log(info)
          resolve(true)
        }
        transporter.close();
    });
  })
}


const generateTable = (data) => {   
  
    let message = ( 
      '<table style="border: 1px solid #333;width:100%;">' +
      '<thead style="text-align:left;">' +
      '<th > Image </th>' +
      '<th> Name </th>' +
      '<th> Qty </th>'  +
      '<th> Price </th>'  +
      '</thead>')

      for (item of data){
        message += '<tr>' +
                  `<td><img src="${item.image}" alt="${item.name}" style="width:100px;height:100px"/> `+
                  '<td>' + item.name + '</td>' +
                  '<td>' + item.quantity + 'x'+ '</td>' +
                  '<td>' + item.price + '</td>' +
                '</tr>'
      }
    
      message += '</table>'
      
      return message
}


module.exports = {
    getTransporter,
    asyncTransporter,
    generateTable
};