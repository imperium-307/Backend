const router = require('express').Router()
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const firebase = require('firebase');
const functions = require('firebase-functions');

var serviceAccount = require('../../serviceAccountKey.json');

doCreateUserWithEmailAndPassword = (email, password) =>
	this.auth.createUserWithEmailAndPassword(email, password);

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://imperium-ab01e.firebaseio.com"
});

var db = admin.firestore();
var users = db.collection('users')

router.get('/', (req, res, next) => {
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

						// TODO Setting is user/employer field
						// Now add user to database
						users.doc(email).set({
							email: email,
							password: hash
						})

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

function makeJWT(email) {
	return jwt.sign({
		email: email
	}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_SESSION_LENGTH })
}

module.exports = router
