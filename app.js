const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv');
const firebase = require('firebase');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const fileUpload = require('express-fileupload')
const cors = require('cors');

const app = express()
dotenv.load({ path: '.env' });

app.use(cors())

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

// We server resumes at url.com/email@example.com.pdf
app.use('/resumes', express.static(__dirname + '/resumes'))
app.use(fileUpload())

const rootRouter = require('./routers/index');

app.use('/', rootRouter)

app.listen(3000, () => {
  console.log('%s Express server listening on port %d', '✓', 3000);
});
