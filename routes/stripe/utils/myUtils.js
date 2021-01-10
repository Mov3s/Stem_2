
const stripe = require('stripe')(process.env.SECRET_KEY)
const CryptoJS = require('crypto-js')

const calculateOrderAmount = async (items) => {
    var itemprice = []
  
    //when calling async/await in a loop... use a MAP 
    //Promise.all for multiple async/await
    await Promise.all(items.map( async (item) => {
      const product = await stripe.products.retrieve(item.id)
      const price = await stripe.prices.retrieve(product.metadata.price_id)
  
      const eachPrice = item.quantity * Number(price.unit_amount_decimal)
      itemprice.push(eachPrice)
    }))
  
    //reduce returns the sum of array
    // console.log('[EACH ITEM PRICE]', itemprice.reduce((a, b) => a + b , 0))

    return itemprice.reduce((a, b) => a + b , 0);
};

const getPriceForProduct = async (items) => {
    var lineitems = []
    var totalPrice = 0
    
      //when calling async/await in a loop... use a MAP 
      //Promise.all for multiple async/await
    await Promise.all(items.map( async (item) => {
      const product = await stripe.products.retrieve(item.product)
      const price = await stripe.prices.retrieve(product.metadata.price_id)

      totalPrice += price.unit_amount
      console.log(totalPrice)
      lineitems.push({ price : price.id, quantity: item.quantity})
    }))

    if (totalPrice > 6500){
      return { lineitems, excludeShipping: true, total: totalPrice }
    }else{
      return { lineitems, excludeShipping: false, total: totalPrice }
    }
}

const getShipping = async (id)=> {

  // let newLines = lineItems
  const product = await stripe.products.retrieve(id)
  const price = await stripe.prices.retrieve(product.metadata.price_id)

  const shippingLine = { price : price.id, quantity: 1}
  // newLines.push({ price : price.id, quantity: 1})

  return { line: shippingLine, price: price.unit_amount }
}

// const getShippingPrice = (id)=> {
//   const product = await stripe.products.retrieve(id)
//   const price = await stripe.prices.retrieve(product.metadata.price_id)
//   const ShippingPrice = price.unit_amount
//   return ShippingPrice
// }


const  randomString = (length) => {
  var chars ='0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
  var result = '';
  for (var i = length; i > 0; --i) 
  result += chars[Math.round(Math.random() * (chars.length - 1))];
  return result;
}

const decrypt = (data) => {
  if (typeof(data) === "string"){

      return CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(data,  process.env.CRYPTO_SECRET, 
          {
              keySize: 128 / 8,
              iv: process.env.CRYPTO_SECRET,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7
          }));
  }
  return JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(data,  process.env.CRYPTO_SECRET, 
  {
      keySize: 128 / 8,
      iv: process.env.CRYPTO_SECRET,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })));
    
}


module.exports = {
    calculateOrderAmount,
    getPriceForProduct,
    getShipping,
    randomString,
    decrypt
    // getShippingPrice
}