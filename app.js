const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv');
const firebase = require('firebase');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

var cors = require('cors');

const app = express()
dotenv.load({ path: '.env' });

app.use(cors())

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

const rootRouter = require('./routers/index');

app.use('/', rootRouter)

app.listen(3000, () => {
  console.log('%s Express server listening on port %d', '✓', 3000);
});
