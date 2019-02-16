const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv');
const firebase = require('firebase');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const app = express()
dotenv.load({ path: '.env' });

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

var config = {
	apiKey: process.env.FIREBASE_KEY,
	authDomain: "imperium-ab01e.firebaseapp.com",
	databaseURL: "https://imperium-ab01e.firebaseio.com",
	storageBucket: "imperium-ab01e.appspot.com",
};
firebase.initializeApp(config);

const rootRouter = require('./routers/index');

app.use('/', rootRouter)

app.listen(3000, () => {
  console.log('%s Express server listening on port %d', '✓', 3000);
});
