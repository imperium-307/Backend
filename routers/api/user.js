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
var jobs = db.collection('jobs')


//dont really need this but wanted to include
//var storageRef = firebase.storage().ref();
//var pictureRef = storageRef.child('myPhoto.jpg');
//var pictureImageRef = storageRef.child('images/myPhoto.jpg');



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
								if (req.body[key] != null && key != "password" && key != "passwordConfirm" && key != "token") {
									u[key] = req.body[key]
								}
							}

							//u[hidden] = 0;

							u.password = hash;

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
								token: makeJWT(email),
								persona: doc.data().persona
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
		// Ok so this is awful and I hate it
		// But it should work, so yeah
		var domain1, domain2;
		var id1, id2;
		var obj1, obj2;

		if (req.body.iam) {
			// Job is liking student
			id1 = req.body.iam;
			id2 = req.body.likee;

			domain1 = jobs;
			domain2 = users;
		} else {
			// Student is liking job
			id1 = req.token.email
			id2 = req.body.likee

			domain1 = users;
			domain2 = jobs;
		}

		domain1.where('email', '==', id1).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					obj1 = doc.data();

					domain2.where('email', '==', id2).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(401).json({err: "no user associated with that email"})
							}

							snapshot.forEach(doc => {
								obj2 = doc.data();

								// obj1 is liking obj2
								if (!obj1.likes) {
									obj1.likes = [];
								}

								if (!obj1.likes.includes(id2)) {
									obj1.likes.push(id2);
									if (obj1.history == null) {
										obj1.history = [{
											action: "like",
											date: Date.now(),
											data: id2
										}];
									} else {
										obj1.history.push({
											action: "like",
											date: Date.now(),
											data: id2
										});
									}
								}

								if (obj2.likes && obj2.likes.includes(id1)) {
									if (!obj1.matches) {
										obj1.matches = []
									}

									if (!obj2.matches) {
										obj2.matches = []
									}

									obj1.matches.push(id2);
									obj2.matches.push(id1);

									domain1.doc(id1).update(obj1)
									domain2.doc(id2).update(obj2)

									return res.status(200).json({match: true})
								} else {
									domain1.doc(id1).update(obj1)

									return res.status(200).json({ok: true})
								}
							})
						})
						.catch(err => {
							console.log(err)
							return res.status(500).json({err: "internal server error"})
						});
				})
			})
			.catch(err => {
				console.log(err)
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/dislike', (req, res, next) => {
	if (req.token != null) {
		// Ok so this is awful and I hate it
		// But it should work, so yeah
		var domain1, domain2;
		var id1, id2;
		var obj1, obj2;

		if (req.body.iam) {
			// Job is liking student
			id1 = req.body.iam;
			id2 = req.body.likee;

			domain1 = jobs;
			domain2 = users;
		} else {
			// Student is liking job
			id1 = req.token.email
			id2 = req.body.likee

			domain1 = users;
			domain2 = jobs;
		}

		domain1.where('email', '==', id1).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					obj1 = doc.data();

					domain2.where('email', '==', id2).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(401).json({err: "no user associated with that email"})
							}

							snapshot.forEach(doc => {
								obj2 = doc.data();

								// obj1 is liking obj2
								if (!obj1.dislikes) {
									obj1.dislikes = [];
								}

								if (!obj1.dislikes.includes(id2)) {
									obj1.dislikes.push(id2);
									if (obj1.history == null) {
										obj1.history = [{
											action: "dislike",
											date: Date.now(),
											data: id2
										}];
									} else {
										obj1.history.push({
											action: "dislike",
											date: Date.now(),
											data: id2
										});
									}
								}

								if (obj1.likes && obj1.likes.includes(id2)) {
									obj1.likes = obj1.likes.filter(e => e !== id2)
								}

								if (obj1.matches && obj1.matches.includes(id2)) {
									obj1.matches = obj1.matches.filter(e => e !== id2)
								}

								domain1.doc(id1).update(obj1)
								return res.status(200).json({ok: true})
							})
						})
						.catch(err => {
							console.log(err)
							return res.status(500).json({err: "internal server error"})
						});
				})
			})
			.catch(err => {
				console.log(err)
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/favorite', (req, res, next) => {
	if (req.token != null) {
		// Ok so this is awful and I hate it
		// But it should work, so yeah
		var domain1, domain2;
		var id1, id2;
		var obj1, obj2;

		if (req.body.iam) {
			// Job is liking student
			id1 = req.body.iam;
			id2 = req.body.likee;

			domain1 = jobs;
			domain2 = users;
		} else {
			// Student is liking job
			id1 = req.token.email
			id2 = req.body.likee

			domain1 = users;
			domain2 = jobs;
		}

		domain1.where('email', '==', id1).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					obj1 = doc.data();

					domain2.where('email', '==', id2).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(401).json({err: "no user associated with that email"})
							}

							snapshot.forEach(doc => {
								obj2 = doc.data();

								// obj1 is favoriting obj2
								if (!obj1.favorites) {
									obj1.favorites = [];
								}
								if (!obj1.likes) {
									obj1.likes = [];
								}

								if (!obj1.favorites.includes(id2)) {
									if (obj1.favorites.length >= 3) {
										return res.status(401).json({err: "You've already favorited 3 companies"})
									} else {
										obj1.favorites.push(id2);
										if (!obj1.likes.includes(id2)) {
											obj1.likes.push(id2);
										}

										if (obj1.history == null) {
											obj1.history = [{
												action: "favorite",
												date: Date.now(),
												data: id2
											}];
										} else {
											obj1.history.push({
												action: "favorite",
												date: Date.now(),
												data: id2
											});
										}

										if (obj2.likes && obj2.likes.includes(id1)) {
											if (!obj1.matches) {
												obj1.matches= [];
											}
											if (!obj2.matches) {
												obj2.matches = [];
											}
											obj1.matches.push(id2);
											obj2.matches.push(id1);
											domain1.doc(id1).update(obj1)
											domain2.doc(id2).update(obj2)
											return res.status(200).json({match: true})
										} else {
											domain1.doc(id1).update(obj1)
											return res.status(200).json({ok: true})
										}
									}
								} else {
									// Unfavorite
									obj1.favorites = obj1.favorites.filter(e => e !== id2)

									if (obj1.history == null) {
										user.history = [{
											action: "unfavorite",
											date: Date.now(),
											data: id2
										}];
									} else {
										obj1.history.push({
											action: "unfavorite",
											date: Date.now(),
											data: id2
										});
									}

									domain1.doc(id1).update(obj1)
									return res.status(200).json({ok: true});
								}
							})
						})
						.catch(err => {
							console.log(err)
							return res.status(500).json({err: "internal server error"})
						});
				})
			})
			.catch(err => {
				console.log(err)
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

					return res.status(200).json({ok: true, user: u})
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

router.post('/create-job', (req, res, next) => {
	if (req.token != null) {
		console.log(req.token.email)
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user doesn't exist"})
				}

				snapshot.forEach(doc => {
					var u = doc.data();

					if (u.persona != "employer") {
						return res.status(401).json({err: "unauthorized"})
					}

					if (!u.lastJob) {
						u.lastJob = 1
					} else {
						u.lastJob++
					}

					var newJob = {
						bio: req.body.bio,
						major: req.body.major,
						jobName: req.body.jobName,
						jobType: req.body.jobType,
						midwest: req.body.midwest,
						south: req.body.south,
						west: req.body.west,
						northeast: req.body.northeast,
						location: req.body.location,
						creator: req.token.email,
						email: req.token.email + "-" + u.lastJob,
						photo: u.photo,
						wage: req.body.wage,
						start: req.body.start,
						end: req.body.end,
						id: u.lastJob,
					}

					jobs.doc(req.token.email + '-' + u.lastJob).set(newJob)

					users.doc(req.token.email).update(u)

					return res.status(200).json({ok: true})
				})
			})
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/ch-job', (req, res, next) => {
	if (req.token != null) {
		var jobid = req.body.jobid;

		jobs.where('creator', '==', req.token.email)
			.where('id', '==', jobid).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "job not found"})
				}

				snapshot.forEach(doc => {
					var j = doc.data();

					var newJob = {
						bio: req.body.bio,
						major: req.body.major,
						company: req.body.company,
						jobType: req.body.jobType,
						midwest: req.body.midwest,
						south: req.body.south,
						west: req.body.west,
						northeast: req.body.northeast,
						location: req.body.location,
						creator: req.token.email,
					}

					jobs.doc(req.token.email + '-' + jobid).update(newJob)

					return res.status(200).json({ok: true})
				})
			})
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/get-job', (req, res, next) => {
	var jobid = req.body.jobid;

	jobs.where('email', '==', jobid).get()
		.then(snapshot => {
			if (snapshot.empty) {
				return res.status(404).json({err: "job not found"})
			}

			snapshot.forEach(doc => {
				return res.status(200).json({jobs: doc.data()})
			})
		})
		.catch(err => {
			return res.status(500).json({err: "internal server error"})
		});
})

router.post('/get-all-jobs', (req, res, next) => {
	var companyemail = req.body.companyemail;

	jobs.where('creator', '==', companyemail).get()
		.then(snapshot => {
			if (snapshot.empty) {
				return res.status(404).json({err: "no jobs found"})
			}

			var jobs = []
			snapshot.forEach(doc => {
				jobs.push(doc.data())
			})

			users.where('email', '==', companyemail).get()
				.then(snapshot => {
					if (snapshot.empty) {
						return res.status(404).json({err: "no jobs found"})
					}

					snapshot.forEach(doc => {
						var company = doc.data()
						delete company.password;
						return res.status(200).json({jobs: jobs, company: company})
					})
				})
				.catch(err => {
					return res.status(500).json({err: "internal server error"})
				});
		})
		.catch(err => {
			return res.status(500).json({err: "internal server error"})
		});
})

router.post('/request-students', (req, res, next) => {
	if (req.token != null) {
		var job = req.body.job
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					u = doc.data();

					var oppositePersona = 'student';
					if (u.persona == 'student') {
						oppositePersona = 'employer';
					}

					jobs.where('jobType', '==', u.jobType).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							}

							var foundJobs = [];
							snapshot.forEach(doc => {
								var job = doc.data()
								foundJobs.push(job);
							})

							// Make sure majors match
							foundJobs = foundJobs.filter(function(e) {
								var myMajors = u.major.split(",");
								var otherMajors = e.major.split(",");

								return myMajors.some(function(el) {
									return otherMajors.includes(el);
								})
							})

							// Makes sure the user hasn't liked/disliked this person before
							foundJobs = foundJobs.filter(function(e) {
								if (u.likes && u.likes.includes(e.email)) {
									return false;
								}

								if (u.dislikes && u.dislikes.includes(e.email)) {
									return false;
								}

								return true;
							})

							// Make sure regions match
							foundJobs = foundJobs.filter(function(e) {
								return (u.northeast && e.northeast) || (u.west && e.west) || (u.south && e.south) || (u.midwest && e.midwest)
							})

							if (foundJobs.length == 0) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							} else {
								return res.status(200).json({users: foundJobs})
							}
						});
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		console.log(req.token);
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/request-jobs', (req, res, next) => {
	if (req.token != null) {
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					u = doc.data();

					var oppositePersona = 'student';
					if (u.persona == 'student') {
						oppositePersona = 'employer';
					}

					jobs.where('jobType', '==', u.jobType).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							}

							var foundJobs = [];
							snapshot.forEach(doc => {
								var job = doc.data()
								foundJobs.push(job);
							})

							// Make sure majors match
							foundJobs = foundJobs.filter(function(e) {
								var myMajors = u.major.split(",");
								var otherMajors = e.major.split(",");

								return myMajors.some(function(el) {
									return otherMajors.includes(el);
								})
							})

							// Makes sure the user hasn't liked/disliked this person before
							foundJobs = foundJobs.filter(function(e) {
								if (u.likes && u.likes.includes(e.email)) {
									return false;
								}

								if (u.dislikes && u.dislikes.includes(e.email)) {
									return false;
								}

								return true;
							})

							// Make sure regions match
							foundJobs = foundJobs.filter(function(e) {
								return (u.northeast && e.northeast) || (u.west && e.west) || (u.south && e.south) || (u.midwest && e.midwest)
							})

							if (foundJobs.length == 0) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							} else {
								return res.status(200).json({users: foundJobs})
							}
						});
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/hide-user', (req, res, next) => {
	if (req.token) {
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					user = doc.data();

					if (user.isHidden) {
						user.isHidden = false;
					} else {
						user.isHidden = true;
					}

					users.doc(req.token.email).update(user)
				});
			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

function makeJWT(email) {
	return jwt.sign({
		email: email
	}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_SESSION_LENGTH })
}

module.exports = router
