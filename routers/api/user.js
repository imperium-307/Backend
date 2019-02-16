const router = require('express').Router()
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

var serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://imperium-ab01e.firebaseio.com"
});

var db = admin.firestore();
var users = db.collection('users')

router.get('/', (req, res, next) => {
	// TODO firebase interactions for getting the current user based on JWT
	return res.status(200).json(req.token)
})

router.post('/signup', (req, res, next) => {
	// Make sure there's not already a valid JWT
	if (req.token == null) {
		var email = req.body.email
		var password = req.body.password
		var passwordConfirm = req.body.passwordConfirm

		// TODO make sure email is not already in database

		// Make sure email is at least x@x.x
		if (email.length < 5) {
			// TODO we can throw some errors in here with .json({err: "thing"})
			return res.status(422)
		}

		if (password != passwordConfirm) {
			// TODO we can throw some errors in here with .json({err: "thing"})
			return res.status(422)
		}

		bcrypt.hash(password, 7, (err, hash) => {
			if (err) {
				// TODO we can throw some errors in here with .json({err: "thing"})
				return res.status(500).json({err: "failed to hash password"})
			}

			// TODO Setting user/employer field
			// Now add user to database
			users.doc(email).set({
				email: email,
				password: hash
			})

			return res.status(200).json({token: makeJWT(email)})
		})
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
					// TODO we can throw some errors in here with .json({err: "thing"})
					return res.status(401)
				}

				snapshot.forEach(doc => {
					bcrypt.compare(password, doc.data().password, function(err, isCorrect) {
						if(isCorrect) {
							return res.status(200).json({
								token: makeJWT(email)
							})
						} else {
							// TODO we can throw some errors in here with .json({err: "thing"})
							return res.status(403)
						}
					});
				});
			})
			.catch(err => {
				console.log('Error getting documents', err);
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
	}, process.env.JWT_SECRET)
}

module.exports = router
