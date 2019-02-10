const router = require('express').Router()
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.post('/', (req, res, next) => {
	// TODO firebase interactions for getting the current user based on JWT
	return res.status(200).json(req.token)
})

router.post('/signup', (req, res, next) => {
	// Make sure there's not already a valid JWT
	if (req.token == null) {
		var email = req.body.email
		var password = req.body.password
		var passwordConfirm = req.body.passwordConfirm

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
				return res.status(500)
			}

			// TODO firebase interactions for creating user
			// That will also involve making sure emails are unique
			// ^ should be an attribute you can set for the emails column

			return res.status(200).json({
				token: makeJWT(email)
			})
		})
	} else {
		// We'll just refresh the token for now...
		// Depending on the app structure we might want to redirect
		return res.status(200).json({
			token: makeJWT(email)
		})
	}
})

router.post('/login', (req, res, next) => {
	// Make sure there's not already a valid JWT
	if (req.token == null) {
		var email = req.body.email
		var password = req.body.password

		// TODO get password hash from firebase
		// var hash = firebase.getUser() <- for example

		bcrypt.compare(password, hash, function(err, res) {
			if(res) {
				return res.status(200).json({
					token: makeJWT(email)
				})
			} else {
				// TODO we can throw some errors in here with .json({err: "thing"})
				return res.status(403)
			} 
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
		// TODO once firebase interactions are figured out
		//id: id,
		email: email
	}, process.env.JWT_SECRET)
}

module.exports = router
