const router = require('express').Router()
const jwt = require('jsonwebtoken');
const apiRouter = require('./api/index')

router.use(setJWT)
router.use('/api', apiRouter)

function setJWT(req, res, next) {
	jwt.verify(req.body.token, process.env.JWT_SECRET, function(err, dec) {
		if (err) {
			req.token = null
		} else {
			req.token = dec
		}

		next()
	})
}

module.exports = router
