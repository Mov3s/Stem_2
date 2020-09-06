const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user' 
    },
    token: {
        type: String,
    },
    expires: { 
        type: Date
    },
    created: { 
        type: Date, 
        default: Date.now
    },
    createdByIp: {
        type: String,
    },
    revoked:{ 
        type: Date,
    },
    revokedByIp:{
        type: String
    },
    replacedByToken:{
         type: String 
    },
});

RefreshTokenSchema.virtual('isExpired').get(() => {
    return Date.now() >= this.expires;
});

RefreshTokenSchema.virtual('isActive').get( () => {
    return !this.revoked && !this.isExpired;
});

RefreshTokenSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.id;
        delete ret.user;
    }
});

module.exports = RefreshToken = mongoose.model('refreshtoken', RefreshTokenSchema);
