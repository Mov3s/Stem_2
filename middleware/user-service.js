const config = require('config');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const mongoose = require('mongoose')
const User = require('../models/User')
const RefreshToken = require('../models/RefreshToken')

require('dotenv').config()
const secret = process.env.JWTSECRET
const { getNextSequence } = require('../utils/myUtils')


const authenticate = async ({ username, password, ipAddress }) => {

    const user = await User.findOne({ email: username.toLowerCase() });

    if (!user){
        throw "Username or password is incorrect"
    }

    const isMatch =  await bcrypt.compare(password, user.password)

    if (!isMatch) {
        throw 'Username or password is incorrect';
    }

    // authentication successful, generate jwt and refresh tokens
    const jwtToken = generateJwtToken(user);
    const refreshToken = generateRefreshToken(user, ipAddress);

    // save refresh token
    await refreshToken.save();

    // console.log('[FFROM AUTH]',refreshToken)

    // return basic details and tokens
    return { 
        ...basicDetails(user),
        jwtToken : jwtToken,
        refreshToken: refreshToken.token
    };
}



const registerUser = async ({email, password, password2, ipAddress }) => {

    let user = await User.findOne({ email });

    if (user) {
       throw 'User already exist'
    }

    if (password !== password2){
        throw 'Passwords must match'
    } 

    const seq = await getNextSequence(mongoose.connection.db, 'userId')
    user = new User({
        idx: seq,
        email,
        password,
        // isAdmin : isAdmin ? isAdmin : false
    });

    // const salt = await bcrypt.genSalt(10);

    user.password = await bcrypt.hash(user.password, 10);

    await user.save();

    // registration successful so generate jwt and refresh tokens
    const jwtToken = generateJwtToken(user);
    const refreshToken = generateRefreshToken(user, ipAddress);

    // save refresh token
    await refreshToken.save();

    // console.log('[FFROM REGISTER]',refreshToken)

    // return basic details and tokens
    return { 
        ...basicDetails(user),
        jwtToken : jwtToken,
        refreshToken: refreshToken.token
    };

}

const refreshToken = async ({ token, ipAddress }) => {
    const refreshToken = await getRefreshToken(token);
    const { user } = refreshToken;

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(user, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(user);

    // return basic details and tokens
    return { 
        ...basicDetails(user),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

 const revokeToken = async ({ token, ipAddress }) => {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

async function getAll() {
    const users = await User.find();
    return users.map(x => basicDetails(x));
}

async function getById(id) {
    const user = await getUser(id);
    return basicDetails(user);
}

async function getRefreshTokens(userId) {
    // check that user exists
    await getUser(userId);

    // return refresh tokens for user
    const refreshTokens = await RefreshToken.find({ user: userId });
    return refreshTokens;
}

// helper functions

async function getUser(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw 'User not found';
    const user = await User.findById(id);
    if (!user) throw 'User not found';
    return user;
}

const getRefreshToken =  async (refreshTok) => {
    const refreshToken = await RefreshToken.findOne({ "token": refreshTok }).populate('users');
    // console.log('[GETREFRESHTOKEN]', refreshToken)
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

const generateJwtToken = (user) => {
    // create a jwt token containing the user id that expires in 3hrs  
    const tk = jwt.sign({ sub: user.id, id: user.id }, secret, { expiresIn: '3h' });
    // console.log('[NEWJWT]👉🏾👉🏾👉🏾', tk)
    return tk
}

const generateRefreshToken = (user, ipAddress) => {
    const tk = randomTokenString()
    // console.log('[NEWREFRESHTOKEN]',tk)
    // create a refresh token that expires in 7 days
    return new RefreshToken({
        user: user.id,
        token: tk,
        expires: new Date(Date.now() + 7*24*60*60*1000),
        createdByIp: ipAddress
    });
}

const randomTokenString = () =>{
    return crypto.randomBytes(40).toString('hex');
}

const basicDetails = (user) => {
    const { _id, email, isAdmin } = user;
    return { _id, email, isAdmin };
}

module.exports = {
    authenticate,
    // refreshToken,
    revokeToken,
    getAll,
    getById,
    getRefreshTokens,
    getRefreshToken,
    generateRefreshToken, 
    generateJwtToken,
    basicDetails,
    registerUser
};