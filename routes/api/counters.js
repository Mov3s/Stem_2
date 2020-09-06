const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');

const { Readable } = require('stream');
const mongoose = require('mongoose')
const mongodb = require('mongodb')

const { check, validationResult } = require('express-validator');

const Counters = require('../../models/Counters');


// ******************ADMIN
// @route    POST api/counters
// @desc     POST counter intial value for index in db   - For handling sequential idx on other models
// @access   Private - for admin
router.post('/', auth, async (req, res) => {

    try{

        const { _id, seq } = req.body

        const counter = new Counters({
            _id: _id,
            seq: seq,
            date: Date.now(),
            dateUpdated: Date.now()
        })

        const newCounter = await counter.save()

        res.status(200).json(newCounter)

    }catch(e){
        res.status(500).json("Something Went wrong")
    }
})


//******************ADMIN
// @route    GET api/counters
// @desc     GET all counters  - For handling sequential idx on other models
// @access   Private - for admin
router.get('/', auth, async (req, res) => {

    try{

        const counter = await Counters.find({}, {__v:0, date: 0, dateUpdated:0})

        if (!counter) return res.status(404).json("NO counter exists")

        res.status(200).json(counter)

    }catch(e){
        res.status(500).json("Something Went wrong")
    }
})








module.exports = router