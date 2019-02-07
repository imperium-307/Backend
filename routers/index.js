const router = require('express').Router()
const apiRouter = require('./api/index')

router.use('/api', apiRouter)

module.exports = router
