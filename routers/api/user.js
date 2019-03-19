const router = require('express').Router()
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const firebase = require('firebase');
const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const fileUpload = require('express-fileupload')
const fs = require('fs')

var serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://imperium-ab01e.firebaseio.com"
});

var transporter = nodemailer.createTransport({
	service: 'gmail',
	secure: false,
	tls: {
		rejectUnauthorized: false
	},
	auth: {
		user: 'imperium397@gmail.com',
		pass: process.env.GMAIL_PASS
	}
});

var db = admin.firestore();
var users = db.collection('users')

router.post('/', (req, res, next) => {
	if (req.token == null) {
		res.status(401).json({err: "unauthorized"})
	} else {
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					var user = doc.data()
					return res.status(200).json(user)
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	}
})

router.post('/signup', (req, res, next) => {
	// Make sure there's not already a valid JWT
	if (req.token == null) {
		var email = req.body.email
		var password = req.body.password
		var bio = req.body.bio
		var username  = req.body.username
		var passwordConfirm = req.body.passwordConfirm
		var persona  = req.body.persona 

		// See if email is already associated with an account
		users.where('email', '==', email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					// Make sure email is at least x@x.x
					if (email.length < 5) {
						return res.status(422).json({err: "invalid email"})
					}

					if (password != passwordConfirm) {
						return res.status(422).json({err: "passwords do not match"})
					}

					bcrypt.hash(password, 7, (err, hash) => {
						if (err) {
							return res.status(500).json({err: "failed to hash password"})
						}

						try {
							u = {}

							for (var key in req.body) {
								if (req.body[key] != null && key != "passwordConfirm" && key != "token") {
									u[key] = req.body[key]
								}
							}

							users.doc(email).set(u)

							// The if statement below is the old way we did tihngs
							// We now do the for loop above and set all the fields we were given
							// in the request, so we don't have to keep updating this endpoint we
							// can just change what we're sending on signup and account updating
							// and it will all be handled generically.  I think this should work
							// for every case, but let me know if this starts causing problems.
							// - CJ

							/*
							if (persona == "student") {
								users.doc(email).set({
									username: username,
									email: email,
									password: hash,
									bio: bio,
									persona: persona,
									internship: (req.body.internship || null),
									coop: (req.body.coop || null),
									fullTime: (req.body.fullTime || null)
								})
							} else if (persona == "employer") {
								users.doc(email).set({
									username: username,
									email: email,
									password: hash,
									bio: bio,
									persona: persona,
									jobType: req.body.jobType
								})
							}
							*/
						} catch(err) {
							return res.status(500).json({err: "internal server error"})
						}

						return res.status(200).json({token: makeJWT(email)})
					})
				}

				snapshot.forEach(doc => {
					return res.status(401).json({err: "email already associated with account"})
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
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
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					bcrypt.compare(password, doc.data().password, function(err, isCorrect) {
						if(isCorrect) {
							return res.status(200).json({
								token: makeJWT(email)
							})
						} else {
							return res.status(403).json({err: "email or password is incorrect"})
						}
					});
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});

	} else {
		// We'll just refresh the token for now...
		// Depending on the app structure we might want to redirect
		return res.status(200).json({
			token: makeJWT(req.token.email)
		})
	}
})

router.post('/reset', (req, res, next) => {
	var email = req.body.email

	users.where('email', '==', email).get()
		.then(snapshot => {
			if (snapshot.empty) {
				return res.status(401).json({err: "no user associated with that email"})
			}

			snapshot.forEach(doc => {
				var newpass = Math.random().toString(36).substring(2, 15);

				opt = {
					from: 'imperium397@gmail.com',
					to: email,
					subject: 'Password reset request from Imperium',
					text: 'Your new password is ' + newpass + ', don\'t go losing it again.'
				}

				transporter.sendMail(opt, function(err, r){
					if (err) {
						return res.status(500).json({err: "internal server error"})
					}
				});

				bcrypt.hash(newpass, 7, (err, hash) => {
					if (err) {
						return res.status(500).json({err: "failed to hash password"})
					}

					users.doc(email).update({
						password: hash
					})

					return res.status(200).json({ok: true})
				})
			});
		})
		.catch(err => {
			return res.status(500).json({err: "internal server error"})
		});
})

router.post('/like', (req, res, next) => {
	if (req.token != null) {
		// TODO update this depending on what @frontend sets it to
		var likee = req.body.likee
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					user = doc.data();

					if (user.likes == null) {
						user.likes = [];
					}

					if (!user.likes.includes(likee)) {
						user.likes.push(likee);

						if (user.history == null) {
							user.history = [{
								action: "like",
								date: Date.now(),
								data: likee
							}];
						} else {
							user.history.push({
								action: "like",
								date: Date.now(),
								data: likee
							});
						}

						// If the person was disliked before, remove them from dislikes
						if (user.dislikes && user.dislikes.includes(likee)) {
							var i = user.dislikes.indexOf(likee);
							if (i > -1) {
								user.dislikes.splice(i, 1);
							}
						} else if (!user.dislikes) {
							user.dislikes = [];
						}

						users.doc(req.token.email).update({
							likes: user.likes,
							dislikes: user.dislikes,
							history: user.history
						})

						return res.status(200).json({ok: true})
					}

					return res.status(401).json({err: "already liked"})
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/dislike', (req, res, next) => {
	if (req.token != null) {
		// TODO update this depending on what @frontend sets it to
		var likee = req.body.likee
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					user = doc.data();

					if (user.dislikes == null) {
						user.dislikes = [];
					}

					if (!user.dislikes.includes(likee)) {
						user.dislikes.push(likee)
						if (user.history == null) {
							user.history = [{
								action: "dislike",
								date: Date.now(),
								data: likee 
							}];
						} else {
							user.history.push({
								action: "dislike",
								date: Date.now(),
								data: likee 
							});
						}

						// If the person was disliked before, remove them from dislikes
						if (user.likes && user.likes.includes(likee)) {
							var i = user.likes.indexOf(likee);
							if (i > -1) {
								user.likes.splice(i, 1);
							}
						} else if (!user.likes) {
							user.likes = [];
						}

						users.doc(req.token.email).update({
							dislikes: user.dislikes,
							likes: user.likes,
							history: user.history
						})

						return res.status(200).json({ok: true})
					} else {
						return res.status(401).json({err: "already disliked"})
					}
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/favorite', (req, res, next) => {
	if (req.token != null) {
		// TODO update this depending on what @frontend sets it to
		var favoritee = req.body.favoritee
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					user = doc.data();

					if (user.favorites == null) {
						user.favorites = [];
					}

					if (!user.favorites.includes(favoritee)) {
						if (user.favorites.length >= 3) {
							return res.status(401).json({err: "max favorites reached"})
						} else {
							user.favorites.push(favoritee);

							if (user.history == null) {
								user.history = [{
									action: "favorite",
									date: Date.now(),
									data: favoritee
								}];
							} else {
								user.history.push({
									action: "favorite",
									date: Date.now(),
									data: favoritee
								});
							}

							users.doc(req.token.email).update({
								favorites: user.favorites,
								history: user.history
							})

							return res.status(200).json({ok: true})
						}
					}

					return res.status(401).json({err: "already favorited"})
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/unfavorite', (req, res, next) => {
	if (req.token != null) {
		// TODO update this depending on what @frontend sets it to
		var favoritee = req.body.favoritee
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					user = doc.data();

					if (user.favorites == null) {
						user.favorites = [];
					}

					if (user.favorites.includes(favoritee)) {
						if (user.favorites.length >= 3) {
							return res.status(401).json({err: "max favorites reached"})
						} else {
							user.favorites = user.favorites.filter(e => e !== favoritee)

							if (user.history == null) {
								user.history = [{
									action: "unfavorite",
									date: Date.now(),
									data: favoritee
								}];
							} else {
								user.history.push({
									action: "unfavorite",
									date: Date.now(),
									data: favoritee
								});
							}

							users.doc(req.token.email).update({
								favorites: user.favorites,
								history: user.history
							})

							return res.status(200).json({ok: true})
						}
					}

					return res.status(401).json({err: "not yet favorited"})
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/delete', (req, res, next) => {
	if (req.token == null) {
		return res.status(401).json({err: "unauthorized"})
	} else {
		users.doc(req.token.email).delete()
		return res.status(200).json({ok: true})
	}
})

router.post('/ch-settings', (req, res, next) => {
	if (req.token != null) {

		if (req.body.email && req.body.email.length < 5) {
			return res.status(422).json({err: "invalid email"})
		}

		if (req.body.password && req.body.confirmPassword && 
			req.body.password != req.body.passwordConfirm) {
			return res.status(422).json({err: "passwords do not match"})
		}

		var u;
		var userRef = db.collection('users').doc(req.token.email);
		var getDoc = userRef.get()
			.then(doc => {
				if (!doc.exists) {
					console.log('No such document!');
				} else {
					u = doc.data()

					if (req.body.password) {
						bcrypt.hash(req.body.password, 7, (err, hash) => {
							if (err) {
								return res.status(500).json({err: "failed to hash password"})
							}
							req.body.password = null;
							req.body.passwordConfirm = null;

							u.password = hash
						})
					}

					for (var key in req.body) {
						if (req.body[key] != null && key != "password" && key != "passwordConfirm" && key != "token") {
							u[key] = req.body[key]
						}
					}

					users.doc(req.token.email).update(u)

					return res.status(200).json({ok: true})
				}
			})
			.catch(err => {
				console.log('Error getting document', err);
				return res.status(500).json({err: "internal server error"})
			});
	}
})

router.post('/ch-resume/:email', (req, res, next) => {
	var file = req.files.file
	console.log(req.files.file)

	file.mv(
		`${__dirname}/../../resumes/` + req.params.email + `.pdf`,
		function (err) {
			if (err) {
				return res.status(500).send({err: "error uploading resume"})
			}

			res.status(200).json({ok: true})
		}
	)
})

router.get('/view/:email', (req, res, next) => {
	users.where('email', '==', req.params.email).get()
		.then(snapshot => {
			if (snapshot.empty) {
				return res.status(404).json({err: "user profile not found"})
			}

			snapshot.forEach(doc => {
				ret = doc.data();
				delete ret.password;
				return res.status(200).json(ret)
			});
		})
		.catch(err => {
			return res.status(500).json({err: "internal server error"})
		});
})

function makeJWT(email) {
	return jwt.sign({
		email: email
	}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_SESSION_LENGTH })
}

module.exports = router
