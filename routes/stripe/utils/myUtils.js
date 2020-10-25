
const stripe = require('stripe')(process.env.SECRET_KEY)


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
    console.log('[EACH ITEM PRICE]', itemprice.reduce((a, b) => a + b , 0))

    return itemprice.reduce((a, b) => a + b , 0);
};

const getPriceForProduct = async (items) => {
    var itemsPrice = []
    
      //when calling async/await in a loop... use a MAP 
      //Promise.all for multiple async/await
      await Promise.all(items.map( async (item) => {
        const product = await stripe.products.retrieve(item.product)
        const price = await stripe.prices.retrieve(product.metadata.price_id)
  
        itemsPrice.push({ price : price.id, quantity: item.quantity})
      }))
  
    return itemsPrice
}


module.exports = {
    calculateOrderAmount,
    getPriceForProduct
}