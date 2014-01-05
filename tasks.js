var db = require('./db');
var deletable = require('./deletable');
var User = require('./users').User;
var Q = require('q');

// constants for task state
var task_states = {
  UNSCHEDULED: 0,
  SCHEDULED: 1,
  DONE: 2
};

var TaskStatus = db.bookshelf.Model.extend({
  tableName: 'task_status',

  user: function() {
    return this.belongsTo(User);
  },

  task: function() {
    return this.belongsTo(Task);
  }
});

var Task = deletable.Deletable.extend({
  tableName: 'tasks',

  hasTimestamps: ['created_at', 'updated_at'],

  owner: function() {
    return this.belongsTo(User, 'owner_id');
  },

  participants: function() {
    return this.belongsToMany(User, 'task_status')
      .through(TaskStatus)
      .withPivot('status');
  },

  getWithAllParticipants: function() {
    return this.fetch({withRelated: ['owner', 'participants']});
  },

  mark_done: function(user_id) {
    var deferred = Q.defer();
    var user = this.related('participants').get(user_id);
    if(user === undefined) {
      deferred.reject(new Error('User is not involved in this task'));
      return deferred.promise;
    }
    var status = user.pivot;
    status.set('status', task_states.DONE);
    return status.save();
  }

}, {
  getWithPermissionCheck: function(task_id, user_id) {
    var e = new Task({id: task_id});
    return e.getWithAllParticipants().then(function() {
      if (e.related('participants').get(user_id)) {
        return e;
      } else {
        throw new Error('Insufficient permissions');
      }
    });
  }
}
);

exports.Task = Task;
exports.TaskStatus = TaskStatus;
exports.task_states = task_states;

function filter_participants(participants, status) {
  return participants.filter(function(participant) {
    return participant.pivot.get('status') == status;
  }).map(function(participant) {
    return participant.toJSON();
  });
}

exports.templateify = function(task, user_id) {
  var data = task.toJSON();
  data.unscheduled = filter_participants(
      task.related('participants'),
      task_states.UNSCHEDULED);

  data.scheduled = filter_participants(
      task.related('participants'),
      task_states.SCHEDULED);

  data.done = filter_participants(
    task.related('participants'),
    task_states.DONE);

  data.owner = task.related('owner').toJSON();

  if(task.get('image_id')) {
    data.image_id = task.get('image_id');
  }

  return data;

};
