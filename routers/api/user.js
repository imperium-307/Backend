const router = require('express').Router()
const bcrypt = require('bcrypt');

router.post('/', (req, res, next) => {
	// TODO firebase interactions for getting the current user based on JWT
	return res.status(200)
})

router.post('/signup', (req, res, next) => {
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
		// TODO respond with JWT

		// TODO attach JWT and other state stuff here with .json({})
		return res.status(200)
	})

})

router.post('/login', (req, res, next) => {
	var email = req.body.email
	var password = req.body.password

	// TODO get password hash from firebase
	// var hash = firebase.getUser()

	bcrypt.compare(password, hash, function(err, res) {
		if(res) {
			// TODO attach JWT and other state stuff here with .json({})
			return res.status(200)
		} else {
			// TODO we can throw some errors in here with .json({err: "thing"})
			return res.status(403)
		} 
	});

})

module.exports = router
