const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv');

const app = express()

dotenv.load({ path: '.env' });

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

const rootRouter = require('./routers/index');

app.use('/', rootRouter)

app.listen(3000, () => {
  console.log('%s Express server listening on port %d', '✓', 3000);
});
