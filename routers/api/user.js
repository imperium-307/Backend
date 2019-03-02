const router = require('express').Router()
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const firebase = require('firebase');
const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

var serviceAccount = require('../../serviceAccountKey.json');

doCreateUserWithEmailAndPassword = (email, password) =>
	this.auth.createUserWithEmailAndPassword(email, password);

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://imperium-ab01e.firebaseio.com"
});


var transporter = nodemailer.createTransport({
	service: 'gmail',
	secure: false,
	tls: {
		rejectUnauthorized: false
	},
	auth: {
		user: 'imperium397@gmail.com',
		pass: process.env.GMAIL_PASS
	}
});

var db = admin.firestore();
var users = db.collection('users')

router.post('/', (req, res, next) => {
	if (req.token == null) {
		res.status(401).json({err: "unauthorized"})
	} else {
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					return res.status(200).json(doc.data())
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	}
})

router.post('/signup', (req, res, next) => {
	// Make sure there's not already a valid JWT
	if (req.token == null) {
		var email = req.body.email
		var password = req.body.password
		var bio = req.body.bio
		var username  = req.body.username
		var passwordConfirm = req.body.passwordConfirm

		// See if email is already associated with an account
		users.where('email', '==', email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					// Make sure email is at least x@x.x
					if (email.length < 5) {
						return res.status(422).json({err: "invalid email"})
					}

					if (password != passwordConfirm) {
						return res.status(422).json({err: "passwords do not match"})
					}

					bcrypt.hash(password, 7, (err, hash) => {
						if (err) {
							return res.status(500).json({err: "failed to hash password"})
						}

						try {
							users.doc(email).set({
								username: username,
								email: email,
								password: hash,
								bio: bio
							})
						}
						catch(err) {
							return res.status(500).json({err: "internal server error"})
						}

						return res.status(200).json({token: makeJWT(email)})
					})
				}

				snapshot.forEach(doc => {
					return res.status(401).json({err: "email already associated with account"})
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		// We'll just refresh the token for now...
		// Depending on the app structure we might want to redirect
		return res.status(200).json({
			token: makeJWT(req.token.email)
		})
	}
})

router.post('/login', (req, res, next) => {
	// Make sure there's not already a valid JWT
	if (req.token == null) {
		var email = req.body.email
		var password = req.body.password

		users.where('email', '==', email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					bcrypt.compare(password, doc.data().password, function(err, isCorrect) {
						if(isCorrect) {
							return res.status(200).json({
								token: makeJWT(email)
							})
						} else {
							return res.status(403).json({err: "email or password is incorrect"})
						}
					});
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});

	} else {
		// We'll just refresh the token for now...
		// Depending on the app structure we might want to redirect
		return res.status(200).json({
			token: makeJWT(email)
		})
	}
})

router.post('/reset', (req, res, next) => {
	var email = req.body.email

	users.where('email', '==', email).get()
		.then(snapshot => {
			if (snapshot.empty) {
				return res.status(401).json({err: "no user associated with that email"})
			}

			snapshot.forEach(doc => {
				var newpass = Math.random().toString(36).substring(2, 15);

				opt = {
					from: 'imperium397@gmail.com',
					to: email,
					subject: 'Password reset request from Imperium',
					text: 'Your new password is ' + newpass + ', don\'t go losing it again.'
				}

				transporter.sendMail(opt, function(err, r){
					if (err) {
						return res.status(500).json({err: "internal server error"})
					}
				});

				bcrypt.hash(newpass, 7, (err, hash) => {
					if (err) {
						return res.status(500).json({err: "failed to hash password"})
					}

					users.doc(email).update({
						password: hash
					})

					return res.status(200).json({ok: true})
				})
			});
		})
		.catch(err => {
			return res.status(500).json({err: "internal server error"})
		});
})

router.post('/delete', (req, res, next) => {
	if (req.token == null) {
		return res.status(401).json({err: "unauthorized"})
	} else {
		users.doc(req.token.email).delete()
		return res.status(200).json({ok: true})
	}
})

router.post('/ch-settings', (req, res, next) => {

	if (req.token != null) {
		var email = req.body.email
		var password = req.body.password
		var passwordConfirm = req.body.passwordConfirm
		var username = req.body.username
		var bio = req.body.bio
		//		var username = req.body.username
		// See if email is already associated with an account

		if (email.length < 5) {
			return res.status(422).json({err: "invalid email"})
		}

		if (password != passwordConfirm) {
			return res.status(422).json({err: "passwords do not match"})
		}

		var userRef = db.collection('users').doc(req.token.email);
		var getDoc = userRef.get()
		.then(doc => {
			if (!doc.exists) {
				console.log('No such document!');
			} else {
				//check if null, if not we do this for the rest as well
				if(password == null){
					password = doc().password
				}
				if(email == null){
					email = doc().email
				}
				if(username == null){
					username = doc().username
				}
				if(bio == null){
					bio = doc().bio
				}

			}
		})
			.catch(err => {
				console.log('Error getting document', err);
			});

		if (req.body.password) {
			bcrypt.hash(password, 7, (err, hash) => {
				if (err) {
					return res.status(500).json({err: "failed to hash password"})
				}
				users.doc(req.token.email).update({
					email: email,
					password: hash,
					bio:  bio,
					username: username
				})
				return res.status(200).json({token: makeJWT(email)})
			})
		} else {
			users.doc(req.token.email).update({
				email: email,
				bio:  bio,
				username: username
			})
		}
	} 
})

router.get('/view/:email', (req, res, next) => {
	if (req.token == null) {
		// You must be logged in to view other's profiles
		res.status(401).json({err: "unauthorized"})
	} else {
		users.where('email', '==', req.params.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					ret = doc.data();
					delete ret.password;
					return res.status(200).json(ret)
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	}
})

function makeJWT(email) {
	return jwt.sign({
		email: email
	}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_SESSION_LENGTH })
}

module.exports = router
