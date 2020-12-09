const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');

const mongoose = require('mongoose')
const mongodb = require('mongodb')

const contentRange = require('content-range');


const { check, validationResult } = require('express-validator');

const User = require('../../models/User');
const ResetPassword = require('../../models/ResetPassword');


//@route   POST api/resetpassword
//@desc    Get all users in db.... info for Admin page 
//@access  Private
router.post('/', async (req, res) => {

    try{

        const { email } = req.body

        const user = await User.findOne({ email: email})

        if (!user){
            return res.status(500).json("Invalid User")
        }



    }catch(e){
        return res.status(500).json({ error: e.message})
    }
})