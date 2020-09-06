"use strict"
const contentRange = require('content-range')

const base64String = (data, ext) =>{
    var base64Flag = `data:image/${ext};charset=utf-8;base64,`
    return base64Flag + data
}

const base64StringVideo = (data, ext) =>{
    var base64Flag = `data:video/${ext};charset=utf-8;base64,`;
    return base64Flag + data
}

 const logError =(err) => {
    if (err){
        console.log(err.message)
    }
}

 const generateUniqueName = (name) => {
    const dateAppend = new Date(Date.now()).toLocaleString();
    const append = dateAppend.split("/").join("").split(":").join("").split(",").join("").split(" ").join("-");

    return`${name.split(".")[0]}` +'_'+`${append}` + `.${name.split(".")[1]}`
}

 const delay = ms => new Promise(res => setTimeout(res, ms));

 const filterByValue = (array, value) => {
    return array.filter((data) =>  JSON.stringify(data).toLowerCase().indexOf(value.toLowerCase()) !== -1);
}

const iterateJSON = (data) => {
    for(key in data){
        if(data.hasOwnProperty(key)){
            console.log(key + ": " + data[key])
        }
    }
}

const getNextSequence = async (db, name) => {

    const check = await db.collection("counters").find({ id: name }).toArray()

    console.log("[LINE 45, CHECK]", check)
    //Create if it doesnt exist
    if (!check){
        const obj = {
            _id : name,
            seq: 1
        }

        await db.collection("counters").insertOne(obj)
    }

    const ret = await db.collection("counters").findOneAndUpdate(
           { _id: name },
           { $inc:
                { seq: 1 }
           },
           {
             new: true,
             upsert: true
           }
    );

    console.log("SEQ IN FUNC", ret.value.seq)

    return ret.value.seq;
 }


 const setHeaderForPartial =  (res, header, first, limit, length) => {
     header = contentRange.format({
        unit: 'items',
        first: first,
        limit: limit,
        length: length
    })

    console.log(header)

    //sets response headers,
    res.set({
        'Access-Control-Expose-Headers': 'Content-Range',
        'Content-Type': 'application/json', 
        'Content-Range': header
    })
}

const setTokenCookie = (res, token) =>
{
    // create http only cookie with refresh token that expires in 7 days
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(Date.now() + 7*24*60*60*1000)
    };
    res.cookie('refreshToken', token, cookieOptions);
}

const setJWTHeader = (res, token) => {
    res.set({
        'Authorization' : 'Bearer ' + token
    })
}

 module.exports = {
     setTokenCookie: setTokenCookie,
     setJWTHeader: setJWTHeader,
     getNextSequence: getNextSequence,
     generateUniqueName: generateUniqueName, 
     delay: delay,
     setHeaderForPartial: setHeaderForPartial,
     base64String: base64String,
     base64StringVideo: base64StringVideo,
     logError: logError,
 }