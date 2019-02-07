const router = require('express').Router()

router.post('/', (req, res, next) => {
	// TODO firebase interactions for getting the current user based on JWT
})

router.post('/signup', (req, res, next) => {
	var email = req.body.email
	var password = req.body.password
	var passwordConfirm = req.body.passwordConfirm

	// Make sure email is valid (enough)
	if (email.length < 5) {
		// TODO we can throw some errors in here with .json({err: "thing"})
		return res.status(422)
	}

	if (password != passwordConfirm) {
		// TODO we can throw some errors in here with .json({err: "thing"})
		return res.status(422)
	}

	// TODO hash password and store it in firebase
	// TODO firebase interactions for creating user
	// That will also involve making sure emails are unique
	// ^ should be an attribute you can set for the emails column
	// TODO respond with JWT
})

router.post('/login', (req, res, next) => {
	var email = req.body.email
	var password = req.body.password

	// TODO hash password and compare it to data in database
	// TODO firebase interactions for getting user to check password
	// TODO respond with JWT
})

module.exports = router
