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

// var config = {
// 	apiKey: process.env.FIREBASE_KEY,
// 	authDomain: "imperium-ab01e.firebaseapp.com",
// 	databaseURL: "https://imperium-ab01e.firebaseio.com",
// 	storageBucket: "imperium-ab01e.appspot.com",
// };
// firebase.initializeApp(config);

const rootRouter = require('./routers/index');

app.use(function(req, res, next) {
	if (req.body.token) {
		req.token = req.body.token
	}
	next()
})

app.use('/', rootRouter)

app.listen(3000, () => {
  console.log('%s Express server listening on port %d', '✓', 3000);
});
