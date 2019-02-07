const express = require('express')
const bodyParser = require("body-parser")

const app = express()

const port = 3000

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

const rootRouter = require('./routers/index');

app.use('/', rootRouter)

app.listen(port, () => {
  console.log('%s Express server listening on port %d', '✓', 3000);
});
