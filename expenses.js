var execute_cql = require('./db').execute_cql;
var users = require('./users');
var Q = require('q');
var uuid = require('node-uuid');

// constants for expense state
var expense_states = {
  WAITING: 0,
  PAID: 1,
};

function create_expense_tables() {
  var create_expenses = execute_cql(
    'CREATE TABLE expenses (' +
      'expense_id uuid PRIMARY KEY, ' +
      'title text, ' +
      'description text, ' +
      'value int, ' +
      'participants map<uuid, int>, ' +
      'receipt_image uuid)'
  );
  var create_status = execute_cql(
    'CREATE TABLE expense_status (' +
      'user_id uuid, ' +
      'expense_id uuid, ' +
      'status int, ' +
      'PRIMARY KEY (user_id, expense_id))'
  );
  return Q.all([create_expenses, create_status]);
}

function store_expense(expense) {
  var id = uuid.v4();
  var user_ids = [];
  return Q.all(
    // Convert emails to uuids
    expense.participants.map(function(email) {
      return users.get_by_email(email).then(function(result) {
        return result.id;
      });
    })
  ).then(function(retreived_ids) {
    user_ids = retreived_ids;
  }).then(function() {
    var users_status = {};
    user_ids.forEach(function(user_id) {
      users_status[user_id] = expense_states.WAITING;
    });
    return execute_cql('INSERT INTO expenses ' +
                       '(expense_id, title, value, participants) ' +
                       'VALUES (?, ?, ?, ?)',
                       [id, expense.title, parseInt(expense.value, 10), users_status]);
  }).then(function() {
    // TODO: abstract this out
    // this is messy
    if (expense.description) {
      return execute_cql('UPDATE expenses ' +
                         'SET description=? ' +
                         'WHERE expense_id=?',
                         [expense.description, id]
                        );
    }
  }).then(function() {
    return user_ids.map(function(user_id) {
      return execute_cql('INSERT INTO expense_status ' +
                         '(user_id, expense_id, status)' +
                         ' VALUES (?, ?, ?)',
                         [user_id, id, 0]);
    });
  }).then(function() {
    return id;
  });
}

function get_expense(id) {
  return execute_cql('SELECT * ' +
                     'FROM expenses ' +
                     'WHERE expense_id=?', 
                     [id])
    .then(function(result) {
      var template_data = {};
      template_data.title = result.rows[0].get('title');
      template_data.description = result.rows[0].get('description');
      template_data.receipt_image = result.rows[0].get('receipt_image');
      var participants_status = result.rows[0].get('participants');
      var participant_uuids = [];
      for (var uuid in participants_status) {
        participant_uuids.push(uuid);
      }
      template_data.value = result.rows[0].get('value');
      return Q.all(
        participant_uuids.map(
          function(uuid) {
            return users.get_user(uuid);
          }
        )
      ).then(function(participant_emails) {
        template_data.participants = participant_emails;
        return template_data;
      });
    });
}

exports.create_expense_tables = create_expense_tables;
exports.store_expense = store_expense;
exports.get_expense = get_expense;
