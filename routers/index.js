const router = require('express').Router()
const jwt = require('jsonwebtoken');
const apiRouter = require('./api/index')

function setJWT(req, res, next) {
	jwt.verify(req.body.token, process.env.JWT_SECRET, function(err, dec) {
		if (err) {
			req.token = null
			console.log("jwt error: " + err)
		} else {
			req.token = dec
		}

		next()
	})
}

router.use(setJWT)
router.use('/api', apiRouter)

module.exports = router
