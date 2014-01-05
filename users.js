var db = require('./db');
var auth = require('./auth');
var knex = require('knex');

var User = db.bookshelf.Model.extend({
  tableName: 'users',

  hasTimestamps: ['created_at', 'updated_at'],

  login: function(password) {
    return auth.hash_password(password, this.get('salt')).then(
      function(hashed_password) {
        if (this.get('password') == hashed_password) {
          return this;
        } else {
          throw new Error("Invalid email or password");
        }
      }.bind(this)
    );
  },

  salt_and_hash: function() {
    var password = this.get('password');
    var salt = auth.generate_salt(128);
    this.set('salt', salt);
    return auth.hash_password(password, salt)
      .then(function(hash_result) {
        this.set('password', hash_result);
        return password;
      }.bind(this));
  },

  change_password: function(password, new_password) {
    return auth.hash_password(password, this.get('salt')).then(
      function(hashed_password) {
        if (this.get('password') == hashed_password) {
          // set new password and salt_and_hash
          this.set('password', new_password);
          return this.salt_and_hash();
        } else {
          throw new Error("Incorrect current password");
        }
      }.bind(this)
    );
  },

  reset_password: function(name) {
    // TODO: Change this to an actual security question
    if (!this.get('name') || this.get('name').toLowerCase() != name.toLowerCase()) {
      throw new Error("Incorrect name or email");
    }
    var new_password = auth.random_password(10);
    this.set('password', new_password);
    return this.salt_and_hash();
  },

  status: function() {
    // returns the status of the user on the task, if this was
    // retrieved relative to an task.
    // Undefined otherwise
    return this.pivot && this.pivot.get('status');
  },

  owned_tasks: function() {
    // TODO: Blargh...
    var Task = require('./tasks').Task;
    return this.hasMany(Task, 'owner_id')
      .query(function(qb) {
        qb.whereNull('deleted');
      });
  },

  participant_tasks: function() {
    // TODO: Blargh...
    var tasks = require('./tasks');
    var Task = tasks.Task;
    var TaskStatus = tasks.TaskStatus;
    return this.belongsToMany(Task)
      .through(TaskStatus)
      .withPivot('status').query(function(qb) {
        qb.whereNull('deleted');
      });
  },

  unscheduled_tasks: function() {
    // Tasks where the user is a participant and has not scheduled the task
    var tasks = require('./tasks');
    return this.participant_tasks()
      .query(function(qb) {
        qb.where('status', '=', tasks.task_states.UNSCHEDULED);
      });
  },

  scheduled_tasks: function() {
    // Tasks where the user is a participant and has not scheduled the task
    var tasks = require('./tasks');
    return this.participant_tasks()
      .query(function(qb) {
        qb.where('status', '=', tasks.task_states.SCHEDULED);
      });
  },

  done_tasks: function() {
    // Tasks where the user is a participant and has not scheduled the task
    var tasks = require('./tasks');
    return this.participant_tasks()
      .query(function(qb) {
        qb.where('status', '=', tasks.task_states.DONE);
      });
  }/*,

  // Used in finished_expenses and unfinished expenses
  _with_waiting: function() {
    var expenses = require('./expenses');
    this.select('id')
      .from('expense_status')
      .whereRaw('expenses.id = expense_status.expense_id')
      .andWhere('expense_status.status', '=', expenses.expense_states.WAITING);
  },


  // Expenses where the user is the owner and all have paid
  finished_expenses: function() {
    return this.owned_expenses()
      .query(function(qb) {
        qb.whereNotExists(this._with_waiting);
      }.bind(this));
  },

  // Expenses where the user is the owner and all have not paid
  unfinished_expenses: function() {
    return this.owned_expenses()
      .query(function(qb) {
        qb.whereExists(this._with_waiting);
      }.bind(this));
  }*/

}, {
  login: function(email, password) {
    var u = new User({email: email});
    return u.fetch().then(function() {
      return u.login(password);
    }).catch(function(err) {
      throw new Error("Invalid email or password");
    });
  }
});

exports.User = User;
