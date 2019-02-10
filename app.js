const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv');
const firebase = require("firebase");

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

//Get a database reference to our blog
const db = firebase.database();
const ref = db.ref("server/saving-data/fireblog");
const usersRef = ref.child("users");
usersRef.set({
	user0: {
		name: "Jon Bon Jovi",
		dob: "March 2, 1962",
		college: "Purdue University"
	},
	user1: {
		name: "Don Quixote",
		dob: "March 5, 1612",
		college: "Indiana University"
	}

});
const hopperRef = usersRef.child("user0");
hopperRef.update({
	"name": "Shawn White"
});
//Completion Callback example
usersRef.set("I'm writing data", function(error) {
  if (error) {
    alert("Data could not be saved." + error);
  } else {
    alert("Data saved successfully.");
  }
});

const name = ref.on("value", function(snapshot) {
	console.log(snapshot.val());
}, function (errorObject) {
	//console.log("The read failed: " + errorObject.code);
});
//can also change "value" to be when a child_removed or child_changed
