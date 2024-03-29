var fs = require('fs');
var Q = require('q');
var auth = require('./auth');
var tasks = require('./tasks');
var Task = tasks.Task;
var TaskStatus = tasks.TaskStatus;

var images = require('./images');
var Image = images.Image;

var users = require('./users');
var settings = require('./settings');
var User = users.User;

var emails= require('./emails');
var Email = emails.Email;

// Error sending
function send_error(res, info, exception) {
  console.error('error:', info + exception);
  console.error('stack:', exception.stack);
  console.log(info + exception);
  res.render('error',
             { title: 'An error occured',
               info: info + exception},
             function(err, response) {
               res.send(500, response);
             });
}

exports.install_routes = function(app) {
  // Main route
  app.get('/', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    /*var unfinished = user.unfinished_expenses();
    var unpaid = user.unpaid_expenses();

    Q.all([unfinished.fetch({withRelated: ['owner', 'participants']}),
           unpaid.fetch({withRelated: ['owner', 'participants']})])
      .then(function() {
        var template_unfinished = unfinished.map(function(x) {
          return expenses.templateify(x, user.get('id'));
        });
        var template_unpaid = unpaid.map(function(x) {
          return expenses.templateify(x, user.get('id'));
        });
*/
        res.render("index", {
          /*title: "Expense Tracker",
          email: user.get('email'),
          name: user.get('name'),
          unfinished_expenses: template_unfinished,
          unpaid_expenses: template_unpaid,
          logged_in: true*/
        });
/*
      }).catch(function(err) {
        send_error(res, 'An error occurred while retrieving the expenses: ', err);
      });*/
  });

  app.post('/login', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    users.User.login(email, password).then(function(user) {
      req.session.user = user;
      res.redirect('/');
    }, function(err) {
      send_error(res, 'Login error: ', err);
    });
  });

  app.get('/login', function(req, res) {
    res.render('login');
  });

  app.post('/logout', function(req, res) {
    Q.ninvoke(req.session, 'destroy').then(function() {
      res.redirect('/login');
    });
  });

  app.get('/logout', auth.check_auth, function(req, res) {
    res.render('logout', { logged_in: true });
  });

  app.post('/create_account', function(req, res) {
    var secret = req.body.secret;
    if (secret != '0xDEADBEEFCAFE') {
      console.log('oh dear!');
      return;
    }
    var email = req.body.email;
    var password = req.body.password;
    var name = req.body.name;
    var new_user = new users.User({
      email: email,
      password: password,
      name: name
    });
    Q.ninvoke(req.session, 'regenerate').then(function() {
      return new_user.salt_and_hash();
    }).then(function() {
      return new_user.save();
    }).then(function() {
      req.session.user = new_user;
      res.redirect('/');
    }, function(err) {
      send_error(res, 'An error occurred while creating the account: ', err);
    });
  });

  app.get('/create_account', function(req, res) {
    res.render('create_account');
  });

  app.post('/reset_password', function(req, res) {
    var secret = req.body.secret;
    if (secret != '0xDEADBEEFCAFE') {
      console.log('oh dear!');
      return;
    }
    var email = req.body.email;
    var name = req.body.name;
    var user = new User({email: email});
    user.fetch().then(function() {
      return user.reset_password(name);
    }).then(function(new_password) {
      // save the email before the user, if the email fails we don't want to actually change
      var email_data = {
        name: user.get('name'),
        password: new_password
      };
      var reset_password_email_desc = {
        type: emails.email_types.RESET_PASSWORD,
        sender: email,
        receiver: email,
        data: JSON.stringify(email_data),
        sent: false
      };
      var reset_password_email = new Email(reset_password_email_desc);
      return reset_password_email.save();
    }).then(function() {
      return user.save();
    }).then(function() {
      res.redirect('/login');
    }).catch(function(err) {
      send_error(res, "Error occurred while resetting password", err);
    });
  });

  app.get('/reset_password', function(req, res) {
    res.render('reset_password');
  });

  app.post('/change_password', auth.check_auth, function(req, res) {
    var secret = req.body.secret;
    if (secret != '0xDEADBEEFCAFE') {
      console.log('oh dear!');
      return;
    }
    var email = req.session.user.email;
    var password = req.body.password;
    var new_password = req.body.new_password;
    var new_password_2 = req.body.new_password_2;
    if (new_password != new_password_2) {
      //TODO move this check to the client
      send_error(res, "New passwords must match", new Error("passwords must match"));
    }
    var user = new User({email: email});
    user.fetch().then(function() {
      return user.change_password(password, new_password);
    }, function(err) {
      send_error(res, "Error occurred while changing password", err);
    }).then(function() {
      return user.save();
    }, function(err) {
      send_error(res, "Error occurred while changing password", err);
    }).then(function() {
      // Make the user log in again
      Q.ninvoke(req.session, 'destroy').then(function() {
        res.redirect('/login');
      });
    });
  });

  app.get('/change_password', function(req, res) {
    res.render('change_password', { logged_in: true });
  });

  // Image routes

  app.get('/images/:id', auth.check_auth, function(req, res) {
    var image_id = req.params.id;
    var image = new Image({id: image_id});
    var user = new User(req.session.user);
    image.fetch().then(function() {
      return image.check_permission(user.get('id'));
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    }).then(function() {
      res.set('Content-Type', 'image/jpeg');
      res.send(image.get('data'));
    }, function(err) {
      send_error(res, 'Insufficient Permissions', err);
    });
  });

  app.get('/thumb/:id/:size', auth.check_auth, function(req, res) {
    var image_id = req.params.id;
    var size_string = req.params.size;
    var user = new User(req.session.user);
    var retrieved_thumbnail;
    images.get_thumbnail(image_id, size_string).then(function(thumbnail) {
      retrieved_thumbnail = thumbnail;
      return thumbnail.check_permission(user.get('id'));
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    }).then(function() {
      res.set('Content-Type', 'image/jpeg');
      res.send(retrieved_thumbnail.get('data'));
    }, function(err) {
      send_error(res, 'Insufficient Permissions', err);
    });
  });

  // Task routes
  app.get('/create_task', auth.check_auth, function(req, res) {
    res.render('create_task', {title: 'Create new task', logged_in: true});
  });

  app.post('/create_task', auth.check_auth, function(req, res) {
    var title = req.body.title;
    var description = req.body.description || undefined;
    var deadline = req.body.deadline;
    var duration = parseInt(req.body.duration);
    var score = 0;
    var owner = req.session.user;
    var participants = [];
    var image_path = req.files.image && req.files.image.path;

    if (req.body.participants) {
      var participant_emails = req.body.participants.split(',');
      participants = participant_emails.map(function(email) {
        return new User({email: email});
      });
    }

    var fetch_user_promises = participants.map(function(participant) {
      return participant.fetch();
    });

    var task = new Task({
      owner_id: owner.id,
      title: title,
      description: description,
      deadline: deadline,
      duration: duration,
      score: score
    });

    var image_store_promise = function(task_id) {
      return Q.nfcall(fs.stat, image_path).then(function(file_stats) {
        if (file_stats.size === 0) {
          return undefined;
        } else {
          return images.store_image(image_path, task_id);
        }
      }).fail(function(err) {
          console.log('ERROR ' + err);
          // If this failed, do not use an image
          return undefined;
      });
    };

    task.save().then(function() {
      return image_store_promise(task.get('id'));
    }).then(function(image) {
      if (image) {
        // set the image_id on the task and save it again
        task.set('image_id', image.get('id'));
        return task.save();
      }
      return undefined;
    }).then(function() {
      var status_promises = fetch_user_promises.map(function(fetch_user_promise, i) {
        fetch_user_promise.then(function() {
          var participant = participants[i];
          var new_status = new TaskStatus({
            user_id: participant.get('id'),
            task_id: task.get('id'),
            status: tasks.task_states.UNSCHEDULED
          });
          return new_status.save();
        });
      });

      return Q.all(status_promises);
    }).then(function() {
      /*// Create an email alert for the new expense
      var new_expense_email_desc = {
        type: emails.email_types.NEW_EXPENSE_NOTIFICATION,
        sender: owner.email,
        receiver: req.body.participants,
        data: JSON.stringify({
          sender: owner.email,
          expense_link: settings.hostname + '/expense/' + expense.get('id')
        }),
        sent: false
      };
      var new_expense_email = new Email(new_expense_email_desc);
      return new_expense_email.save();*/
    }).then(function() {
      res.redirect('/task/' + task.get('id'));
    }, function(err) {
      send_error(res, 'An error occurred making the task: ', err);
    });
  });

  app.get('/task/:task_id', auth.check_auth, function(req, res) {
    var task_id = req.params.task_id;
    var user = new User(req.session.user);
    Task.getWithPermissionCheck(task_id, user.get('id')).then(function(task) {
      if (!task) {
        send_error(res, 'Task not found ', new Error('Task not found'));
        return;
      }
      res.render('task', {title: 'Task detail',
                             task: tasks.templateify(task, user.get('id')),
                             logged_in: true});
    }, function(err) {
      send_error(res, 'An error occurred retrieving the task: ', err);
    });
  });

  // TODO: this should be a post
  app.get('/task/:task_id/done/:user_id', function(req, res) {
    // Mark the task as paid for user user_id
    var task = new Task({'id': req.params.task_id});
    var user_id = req.params.user_id;
    task.getWithAllParticipants().then(function() {
      return task.mark_done(user_id);
    }).then(function() {
      res.send(200);
    });
  });

  // TODO: Make this a post also
  app.get('/task/:task_id/delete', auth.check_auth, function(req, res) {
    var task = new Task({id: req.params.task_id});
    var user_id = req.session.user.id;
    task.fetch().then(function() {
      if (task.get('owner_id') == user_id) {
        return task.destroy();
      }
    }).then(function() {
      res.redirect('/');
    }, function(err) {
      send_error(res, 'An error occurred while trying to delete the task: ', err);
    });
  });

  var port = process.env.PORT || 3000;
  app.listen(port, function() {
    console.log("Listening on", port);
  });

};
