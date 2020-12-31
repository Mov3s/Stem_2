const express = require('express');
const router = express.Router();

const mongoose = require('mongoose')
const mongodb = require('mongodb')

const contentRange = require('content-range');
require('dotenv').config()

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');

const { level } = require('../../utils/LogLevel')

// const xoauth2 = require('xoauth2');
// var smtpTransport = require("nodemailer-smtp-transport");

const { check, validationResult } = require('express-validator');

//auth middleware
const auth = require('../../middleware/auth');
const UserService = require('../../middleware/user-service')

//models
const User = require('../../models/User');
const ResetPassword = require('../../models/ResetPassword');
const Customer = require('../../models/Customer');

const { getTransporter } = require('../../utils/transporter')

const liveLink = 'http://localhost:3000'

//TEST ROUTE
// @route    GET api/resetpassword
// @desc     GET get reset password link
// @access   private -- fixx
// router.get('/',  async (req, res)=> {
//     try{

//         const newToken = 'zsxdcfgvhbjknmlfythkjlmjhgcgvb'
//         let message2 = {
//             from: 'House <housesubletting@gmail.com>',
//             to: 'Isioma Anofienam <isioma.chuck@gmail.com>',
        
//             // Subject of the message
//             subject: 'Reset Password ✔ #', 

//             // plaintext body
//             text: 'Follow this link to reset your password',

//             html: "<p>We heard that you lost your InphinityX password. Sorry about that</p><br/>" +
//                 "<p>But don’t worry! You can use the following link to reset your password:</p><br/>"+
//                 "<p>If you don’t use this link within 1 hour, it will expire.</p>"+
//                 `<p>To get a new password reset link, visit <a href='http://localhost:3000/resetpassword/${newToken}'>http://localhost:3000/resetpassword</a></p><br/>` +
//                 "<p>Thanks</p>"+
//                 "<p>The InphinityX Team</p>"
//         }

//         let message = {
//             // Comma separated list of recipients
//             from: 'House <housesubletting@gmail.com>',
//             to: 'Isioma Anofienam <isioma.chuck@gmail.com>',
        
//             // Subject of the message
//             subject: 'Nodemailer is unicode friendly ✔ #', //
        
//             // plaintext body
//             text: 'Hello to myself!',
        
//             // // HTML body
//             // html:
//             //     '<p><b>Hello</b> to myself <img src="cid:note@example.com"/></p>' +
//             //     '<p>Here\'s a nyan cat for you as an embedded attachment:<br/><img src="cid:nyan@example.com"/></p>',
        
//             // Apple Watch specific HTML body
//             // watchHtml: '<b>Hello</b> to myself',
//         }

//         transporter.sendMail(message2, (error, info) => {
//             if (error) {
//                 console.log('Error occurred');
//                 console.log(error.message);
//                 return;
//             }
//             console.log('Message sent successfully!');
//             console.log('Server responded with "%s"', info.response);
//             transporter.close();
//             return res.status(200).json(info)
//         });


//     }catch(e){
//         console.log(e.message)
//     }
// })
//TEST ROUTE




//@route   POST api/resetpassword
//@desc    Get all users in db.... info for Admin page 
//@access  Private
router.post('/',
    // auth,
    [
        [
        check('email', 'Please include a valid email')
        .not()
        .isEmpty()
        ]
    ],
    async (req, res) => {

    try{

        const secret = process.env.JWTSECRET

        const { email } = req.body

        const user = await User.findOne({ email: email })

        if (!user){
            return res.status(500).json({ success: false, msg: "User doesn't exist - Please use the register page to create an account"})
        }

        // create a jwt token containing the user id that expires in 1hrs  
        const newToken = jwt.sign({ sub: user.id, id: user.id }, secret, { expiresIn: '1h' });
        // const newToken = UserService.generateJwtToken(user)
        
        const transporter = getTransporter()
        let message = {
            from: 'InphinityX <housesubletting@gmail.com>',
            to: user.email,
        
            // Subject of the message
            subject: 'Reset Password ✔ #', 

            // plaintext body
            text: 'Follow this link to reset your password',

            html: "<p>We heard that you lost your InphinityX password. Sorry about that</p>" +
                `<p>But don’t worry! You can use the following link to reset your password: <a href='${liveLink}/resetpassword/${newToken}'>${liveLink}/resetpassword/${newToken}</a></p>`+
                "<p>If you don’t use this link within 3 hour, it will expire.</p>"+
                `<p>To get a new password reset link, visit <a href='${liveLink}/resetpassword'>${liveLink}/resetpassword</a></p><br/>` +
                "<p>Thanks</p>"+
                "<p>The InphinityX Team</p>"
        }

        transporter.sendMail(message, (error, info) => {
            if (error) {
                // console.log(error.message);
                Logs.addLog(level.error, error.message, error.stack)
                return;
            }
            // console.log('Server responded with "%s"', info.response);
            Logs.addLog(level.info, `SMTP Server responded with ${info.response} for User - ${user.id}`, '')
            transporter.close();
        });

        return res.status(200).json({ 
            success: true, 
            message: `Reset password email sent to ${user.email}`
        })

    }catch(error){
        Logs.addLog(level.error, error.message, error.stack)
        return res.status(500).json({ success: false, error: error.message})
    }
})


//@route   POST api/resetpassword/finish
//@desc    Get all users in db.... info for Admin page 
//@access  Private
router.post('/finish',
    // auth,
    [
        [
            check('password', 'Please include a valid email')
            .not()
            .isEmpty(),
            check('password2', 'Please include a valid email')
            .not()
            .isEmpty()
        ]
    ],
    async (req, res) => {

    try{

        const secret = process.env.JWTSECRET

        const { token, password, password2 } = req.body

        let userId, user, tokenError
        // Check if not token
        if (!token || token === null) {
            return res.status(401).json({ success: false, msg: 'No token, authorization denied' });
        }

        if (password !== password2){
            return res.status(401).json({ success: false, msg: 'Passwords do not match'})
        }

        //verifytoken with jsonwebtoken
        await jwt.verify(token, secret, async (error, decoded) => {
            tokenError = error
            if (decoded){
                userId = decoded.id
            }
        });

        if(tokenError){

            if (tokenError.message === 'jwt expired'){
              Logs.addLog(level.error, tokenError.name + ': '+tokenError.message, tokenError.stack)
              return res.status(401).json({ success: false, msg: tokenError.message });
            }

            if (tokenError.message === 'invalid signature'){
                Logs.addLog(level.error, tokenError.name + ': '+tokenError.message, tokenError.stack)
                return res.status(401).json({ success: false, msg: tokenError.message });
              }

            Logs.addLog(level.error, tokenError.name + ': '+tokenError.message, tokenError.stack)
            return res.status(401).json({ success: false, msg: 'Invalid Authorization Token' });
        } 


        let userPasswords = await ResetPassword.find({ user_id: userId })

        //loop through arrays of usedTokens
        if (userPasswords.length > 0){
            var userTokens = userPasswords[0].usedTokens

            if (userTokens.length > 0){
                for( let value of userTokens){
                    if (value === token){
                        return res.status(401).json({ 
                            success: false,
                            msg: 'Invalid Token - Token already Used'
                        })
                    }
                }
            }

            user = await User.findById(userId)

            if (!user){
                Logs.addLog(level.error, `User _id: ${user._id} >> DOESN'T EXIST`, error.message)
                return res.status(401).json({ message: "User doesn't exist"})
            }else{

                let newUserPwd = await bcrypt.hash(password, 10)

                userTokens.push(token)

                userPasswords[0].oldpassword = userPasswords[0].newpassword ? userPasswords[0].newpassword : userPasswords[0].oldpassword
                userPasswords[0].newpassword = newUserPwd ? newUserPwd : userPasswords[0].newpassword
                userPasswords[0].usedTokens = userTokens ? userTokens : userPasswords[0].usedTokens
                await userPasswords[0].save()

                user.password = password ? newUserPwd : user.password;
                await user.save()
            }

        }else{

            user = await User.findById(userId)

            if (!user){
                Logs.addLog(level.error, `User _id: ${user._id} >> DOESN'T EXIST`, error.message)
                return res.status(401).json({ msg: "User doesn't exist" })

            }else{

                let newUserPwd = await bcrypt.hash(password, 10)

                let newUsedToken = [token]

                let resetPassword = new ResetPassword({
                    user_id: user.id,
                    oldpassword: user.password,
                    newpassword: newUserPwd,
                    usedTokens: newUsedToken
                    //save reset passwors details
                });

                await resetPassword.save()

                user.password = password ? newUserPwd : user.password;

                await user.save()

            }
        }

        const customer = await Customer.find({ user_id: user.id})
            
        const transporter = getTransporter()

            //user exist reset password and sendEmail
        let message = {
            from: 'InphinityX <housesubletting@gmail.com>',
            to: user.email,
        
            // Subject of the message
            subject: 'Reset Password Successful✔ #', 

            html: `<p>Hello ${customer.length > 0 ? customer[0].lastname : user.email},</p>` +
                `<p>We wanted to let you know that your InphinityX password was reset</p>`+
                `<p>If you did not perform this action, you can recover access by entering ${user.email} into the form at <a href='${liveLink}'/resetpassword'>${liveLink}/resetpassword</a> </p>`+
                `<p>Please do not reply to this email with your password. We will never ask for your password, and we strongly discourage you from sharing it with anyone.</p><br/>` +
                "<p>Thanks</p>"+
                "<p>The InphinityX Team</p>"
        }

        transporter.sendMail(message, (error, info) => {
            if (error) {
                // console.log(error.message);
                Logs.addLog(level.error, error.message, error.stack)
                return;
            }
            console.log('Server responded with "%s"', info.response);
            Logs.addLog(level.info, `SMTP Server responded with ${info.response} for User - ${user.id}`, '')
            transporter.close();
        });


        return res.status(200).json({ 
            success: true, 
            message: `User-${user.email} password reset successfully`
        })

    }catch(error){
        Logs.addLog(level.error, error.message, error.stack)
        return res.status(500).json({ success: false, error: error.message})
    }
})



module.exports = router;