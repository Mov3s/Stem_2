const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors')
const morgan = require('morgan')
const helmet = require('helmet')

require('dotenv').config()
const stripe = require('stripe')(process.env.SECRET_KEY)

// var passport = require('passport')
const cookieParser = require('cookie-parser')
const Blog = require('./models/Blog')

const slowdown = require('express-slow-down')
const RateLimit = require('express-rate-limit')
// const RedisStore = require('rate-limit-redis');
// const client = require('redis').createClient()

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(helmet())
app.use(express.json({extended: false}))
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

//For Request logging
app.use(morgan('common'))

// client.on("connect", function(error) {
//   console.error("REDIS CONNECTED");
// });

// const limiter = new RateLimit({
//   store: new RedisStore({
//     client: client
//   }),
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   delayMs: 0 // disable delaying - full speed until the max limit is reached
// });


// app.use('/api/', limiter)


// Define Routes
app.use('/api/users', require('./routes/api/users'));

app.use('/api/auth', require('./routes/api/auth'));

app.use('/api/products', require('./routes/api/product'));

app.use('/api/categories', require('./routes/api/category'));

app.use('/api/blogs', require('./routes/api/blog'));

app.use('/api/customers', require('./routes/api/customer'));

app.use('/api/orders', require('./routes/api/orders'))

app.use('/api/counters', require('./routes/api/counters'))

app.use('/api/invoices', require('./routes/api/invoices'))

app.use('/api/reviews', require('./routes/api/reviews'))

app.use('/api/extra', require('./routes/api/extras'))

app.use('/api/newsletter', require('./routes/api/newsletter'))

//testing bespoke integration
// app.use('/api/createsession', require('./routes/stripe/createSession'))

app.use('/api/create-payment-intent', require('./routes/stripe/createPaymentIntent'))
app.use('/api/confirm-payment-intent', require('./routes/stripe/confirmPaymentIntent'))
app.use('/api/create-session', require('./routes/stripe/createSession'))

//Test routes
app.get('/test', async (req, res) => {

  try {
    const indexes = await Blog.collection.getIndexes()
    console.log(indexes)

    // Blog.collection.dropIndexes()
    res.json("Testing this routes");

  }catch(err) {
    console.log(err)
  }
})

app.use(require('./middleware/error-handler'))

// // Serve static assets in production
// if (process.env.NODE_ENV === 'production') {
//   // Set static folder
//   app.use(express.static('client/build'));

//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
//   });
// }

const PORT = process.env.PORT || 5000;

// \"redis-server\"

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));



