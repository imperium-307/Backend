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
var messages = db.collection('messages')

// Ya like hacks?
var messagesHack = {};
messages.onSnapshot(snapshot => {
	snapshot.forEach(doc => {
		mes = doc.data()
		messagesHack[mes.id] = Date.now();
	})
}, err => {
	console.log(`Encountered error: ${err}`);
});

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
						console.log(err)
						console.log("failed sending email to :", opt.to)
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
									if (!obj1.matchesObject) {
										obj1.matchesObject = [];
									}
									if (!obj2.matchesObject) {
										obj2.matchesObject = [];
									}

									obj1.matches.push(id2);
									obj2.matches.push(id1);
									obj1.matchesObject.push({
										photo: obj2.photo,
										name: obj2.username || obj2.jobName,
										email: obj2.email
									});
									obj2.matchesObject.push({
										photo: obj1.photo,
										name: obj1.username || obj1.jobName,
										email: obj1.email
									});

									domain1.doc(id1).update(obj1)
									domain2.doc(id2).update(obj2)

									sendEmail(res, id1, id2, obj1, obj2)

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
								if(!obj1.favoritesObject) {
									obj1.favoritesObject = [];
								}

								if (!obj1.favorites.includes(id2)) {
									if (obj1.favorites.length >= 3) {
										return res.status(401).json({err: "You've already favorited 3 companies"})
									} else {
										obj1.favorites.push(id2);
										if (!obj1.likes.includes(id2)) {
											obj1.likes.push(id2);
										}
										obj1.favoritesObject.push({
											photo: obj2.photo,
											name: obj2.username || obj2.jobName,
											email: obj2.email
										})

										if (obj2.emailNotifications && obj2.favoriteNotifications) {
											var opt = {
												from: 'imperium397@gmail.com',
												to: obj2.creator,
												subject: 'You have a new favorite!',
												text: 'Your job posting ' + obj2.jobName + ' was just favorited by ' + obj1.username
											}

											transporter.sendMail(opt, function(err, r){
												if (err) {
													console.log(err)
													console.log("failed sending email to :", opt.to)
												}
											});
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
											if (!obj1.matchesObject) {
												obj1.matchesObject = [];
											}
											if (!obj2.matchesObject) {
												obj2.matchesObject = [];
											}
											obj1.matches.push(id2);
											obj2.matches.push(id1);
											obj1.matchesObject.push({
												photo: obj2.photo,
												name: obj2.username || obj2.jobName,
												email: obj2.email
											});
											obj2.matchesObject.push({
												photo: obj1.photo,
												name: obj1.username || obj1.jobName,
												email: obj1.email
											});
											domain1.doc(id1).update(obj1)
											domain2.doc(id2).update(obj2)

											sendEmail(res, id1, id2, obj1, obj2)

											return res.status(200).json({match: true})
										} else {
											domain1.doc(id1).update(obj1)
											return res.status(200).json({ok: true})
										}
									}
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
	if (req.files) {
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
	}
})

router.get('/view/:email', (req, res, next) => {
	console.log(req.params.email)
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

router.post('/post-view', (req, res, next) => {
	if (req.token) {
		users.where('email', '==', req.body.email).get()
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
	} else {
		return res.status(500).json({err: "internal server error"})
	}
})

router.post('/create-job', (req, res, next) => {
	if (req.token != null) {
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
						emailNotifications: true,
						desktopNotifications: true,
						favoriteNotifications: true,
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
			.where('email', '==', jobid).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "job not found"})
				}

				snapshot.forEach(doc => {
					var j = doc.data();

					for (var key in req.body) {
						if (req.body[key] != null && key != "jobid" && key != "password" && key != "passwordConfirm" && key != "token") {
							j[key] = req.body[key]
						}
					}

					jobs.doc(jobid).update(j)

					return res.status(200).json({ok: true})
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

router.post('/get-job', (req, res, next) => {
	var jobid = req.body.jobid;

	jobs.where('email', '==', jobid).get()
		.then(snapshot => {
			if (snapshot.empty) {
				return res.status(404).json({err: "job not found"})
			}

			snapshot.forEach(doc => {
				return res.status(200).json(doc.data())
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
				// They don't have any jobs yet, but still give them the company name
				users.where('email', '==', companyemail).get()
					.then(snapshot => {
						if (snapshot.empty) {
							return res.status(404).json({err: "company not found"})
						}

						snapshot.forEach(doc => {
							var company = doc.data()
							delete company.password;
							return res.status(200).json({company: company})
						})
					})
					.catch(err => {
						return res.status(500).json({err: "internal server error"})
					});

				return;
			}

			var jobs = []
			snapshot.forEach(doc => {
				jobs.push(doc.data())
			})

			users.where('email', '==', companyemail).get()
				.then(snapshot => {
					if (snapshot.empty) {
						return res.status(404).json({err: "company not found"})
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
		var jobid = req.body.jobid
		jobs.where('creator', '==', req.token.email)
			.where('email', '==', jobid).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					u = doc.data();

					users.where('jobType', '==', u.jobType).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							}

							var foundStudents = [];
							snapshot.forEach(doc => {
								var student = doc.data()
								if (student.isHidden == false || student.isHidden == undefined) {
									foundStudents.push(student);
								}
							})

							// Make sure majors match
							foundStudents = foundStudents.filter(function(e) {
								var myMajors = u.major.replace(", ", ",").split(",");
								var otherMajors = e.major.replace(", ", ",").split(",");

								return myMajors.some(function(el) {
									return otherMajors.includes(el);
								})
							})

							// Makes sure the user hasn't liked/disliked this person before
							foundStudents = foundStudents.filter(function(e) {
								if (u.likes && u.likes.includes(e.email)) {
									return false;
								}

								if (u.dislikes && u.dislikes.includes(e.email)) {
									return false;
								}

								return true;
							})

							// Make sure regions match
							foundStudents = foundStudents.filter(function(e) {
								return (u.northeast && e.northeast) || (u.west && e.west) || (u.south && e.south) || (u.midwest && e.midwest)
							})

							if (foundStudents.length == 0) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							} else {
								return res.status(200).json({students: foundStudents})
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

router.post('/request-jobs', (req, res, next) => {
	if (req.token != null) {
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(404).json({err: "user profile not found"})
				}

				snapshot.forEach(doc => {
					u = doc.data();

					jobs.where('jobType', '==', u.jobType).get()
						.then(snapshot => {
							if (snapshot.empty) {
								return res.status(404).json({err: "There are no more profiles available, check back later"})
							}

							var foundJobs = [];
							snapshot.forEach(doc => {
								var job = doc.data()
								if (job.isHidden == false || job.isHidden == undefined) {
									foundJobs.push(job);
								}
							})

							// Make sure majors match
							foundJobs = foundJobs.filter(function(e) {
								var myMajors = u.major.replace(", ", ",").split(",");
								var otherMajors = e.major.replace(", ", ",").split(",");

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
								return res.status(200).json({jobs: foundJobs})
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

router.post('/message', (req, res) => {
	var message = req.body.message;
	var recipient = req.body.recipient;
	var iam = req.body.iam;

	if (req.token) {
		var people = [iam || req.token.email, recipient];
		people.sort()
		var peopleString = people.join('*');

		messages.where('id', '==', peopleString).get()
			.then(snapshot => {
				if (snapshot.empty) {
					messages.doc(peopleString).set({
						id: peopleString,
						messages: [message]
					});

					return res.status(200).json({ok: true})
				}

				snapshot.forEach(doc => {
					mes = doc.data();
					mes.messages.push(message);

					messages.doc(peopleString).update(mes)
					return res.status(200).json({ok: true})
				});

			})
			.catch(err => {
				return res.status(500).json({err: "internal server error"})
			});

	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})

router.post('/messages-after', (req, res) => {
	var recipient = req.body.recipient;
	var iam = req.body.iam;
	var after = req.body.after;

	if (req.token) {
		var people = [iam || req.token.email, recipient];
		people.sort()
		var peopleString = people.join('*');

		if (!messagesHack[peopleString] || after == 0 || messagesHack[peopleString] > after) {

			if (!messagesHack[peopleString]) {
				messagesHack[peopleString] = 1;
			}

			messages.where('id', '==', peopleString).get()
				.then(snapshot => {
					if (snapshot.empty) {
						return res.status(404).json({err: "no messages yet"})
					}

					snapshot.forEach(doc => {
						mes = doc.data();

						return res.status(200).json({messages: mes.messages})
					});

				})
				.catch(err => {
					return res.status(500).json({err: "internal server error"})
				});
		} else {
			return res.status(200).json({ok: true})
		}
	} else {
		return res.status(401).json({err: "unauthorized"})
	}
})


router.post('/unmatch', (req, res) => {
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

								if (obj2.matches && obj1.matches) {
									obj2.matches = obj2.matches.filter(e => e !== id1)
									obj1.matches = obj1.matches.filter(e => e !== id2)
									obj2.matchesObject = obj2.matchesObject.filter(e => e.email !== id1)
									obj1.matchesObject = obj1.matchesObject.filter(e => e.email !== id2)

									if (obj1.history == null) {
										obj1.history = [{
											action: "unmatch",
											date: Date.now(),
											data: id2
										}];
									} else {
										obj1.history.push({
											action: "unmatch",
											date: Date.now(),
											data: id2
										});
									}

									if (obj2.history == null) {
										obj2.history = [{
											action: "unmatch",
											date: Date.now(),
											data: id1
										}];
									} else {
										obj2.history.push({
											action: "unmatch",
											date: Date.now(),
											data: id1
										});
									}

									domain1.doc(id1).update(obj1)
									domain2.doc(id2).update(obj2)
									return res.status(200).json({ok: true})
								} else {
									return res.status(401).json({err: "not matched yet"})
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

router.post('/unfavorite', (req, res) => {
	var likee = req.body.likee;

	if (req.token != null) {
		users.where('email', '==', req.token.email).get()
			.then(snapshot => {
				if (snapshot.empty) {
					return res.status(401).json({err: "no user associated with that email"})
				}

				snapshot.forEach(doc => {
					obj1 = doc.data();
					if (obj1.persona == "employer") {
						return res.status(401).json({err: "employer's cannot favorite"})
					}

					if (obj1.history == null) {
						obj1.history = [{
							action: "unfavorite",
							date: Date.now(),
							data: likee
						}];
					} else {
						obj1.history.push({
							action: "unfavorite",
							date: Date.now(),
							data: likee
						});
					}

					obj1.favorites = obj1.favorites.filter(e => e !== likee)
					obj1.favoritesObject = obj1.favoritesObject.filter(e => e.email !== likee)

					users.doc(req.token.email).update(obj1)
					return res.status(200).json({ok: true})
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

function makeJWT(email) {
	return jwt.sign({
		email: email
	}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_SESSION_LENGTH })
}

function sendEmail(res, id1, id2, obj1, obj2) {
	if (id1.includes('-')) {
		// Liker is a job
		if (obj1.emailNotifications) {
			var opt = {
				from: 'imperium397@gmail.com',
				to: obj1.creator,
				subject: 'You have a new match!',
				text: 'You just matched with ' + obj2.username + '!'
			}

			transporter.sendMail(opt, function(err, r){
				if (err) {
					console.log(err)
					console.log("failed sending email to :", opt.to)
				}
			});
		}

		if (obj2.emailNotifications) {
			opt = {
				from: 'imperium397@gmail.com',
				to: obj2.email,
				subject: 'You have a new match!',
				text: 'You just matched with ' + obj1.jobName + '!'
			}

			transporter.sendMail(opt, function(err, r){
				if (err) {
					console.log(err)
					console.log("failed sending email to :", opt.to)
				}
			});
		}
	} else {
		// Liker is a student
		if (obj1.emailNotifications) {
			var opt = {
				from: 'imperium397@gmail.com',
				to: obj1.email,
				subject: 'You have a new match!',
				text: 'You just matched with ' + obj2.jobName + '!'
			}

			transporter.sendMail(opt, function(err, r){
				if (err) {
					console.log(err)
					console.log("failed sending email to :", opt.to)
				}
			});
		}

		if (obj2.emailNotifications) {
			opt = {
				from: 'imperium397@gmail.com',
				to: obj2.creator,
				subject: 'You have a new match!',
				text: 'You just matched with ' + obj1.username+ '!'
			}

			transporter.sendMail(opt, function(err, r){
				if (err) {
					console.log(err)
					console.log("failed sending email to :", opt.to)
				}
			});
		}
	}
}

module.exports = router
