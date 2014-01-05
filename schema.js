var db = require('./db');
var knex = db.bookshelf.knex;
var Q = require('q');

// TODO: add foreign key constraints

exports.create_users = function() {
  return knex.schema.createTable('users', function(table) {
    table.string('email').index().unique();
    table.text('password');
    table.text('salt');
    table.string('name');
    table.increments('id');
    table.timestamps();
  });
};

exports.create_tasks = function() {
  return knex.schema.createTable('tasks', function(table) {
    table.increments('id');
    table.integer('owner_id').index().notNullable();
    table.text('title').notNullable();
    table.text('description');
    table.dateTime('deadline');
    table.bigInteger('duration');
    table.integer('score');
    table.integer('image_id');
    table.boolean('deleted');
    table.timestamps();
  });
};

exports.create_task_status = function() {
  return knex.schema.createTable('task_status', function(table) {
    table.increments('id');
    table.integer('user_id').notNullable();
    table.integer('task_id').notNullable();
    table.integer('status').notNullable();
  }).then(function() {
    // Can't create this index using knex directly
    return knex.raw('CREATE UNIQUE INDEX UIX_task_status ' +
                    'on task_status (user_id, task_id)');
  });
};

exports.create_emails = function() {
  return knex.schema.createTable('emails', function(table) {
    table.increments('id');
    table.text('sender').notNullable();
    table.text('receiver').notNullable();
    table.integer('type').notNullable();
    table.text('data').notNullable();
    table.boolean('sent').notNullable();
    table.timestamps();
  }).then(function() {
    return knex.raw('CREATE INDEX pending_emails on emails (sent)');
  });
};

exports.create_images = function() {
  return knex.schema.createTable('images', function(table) {
    table.increments('id');
    table.binary('data').notNullable();
    table.integer('thumbnail_of');
    table.string('size');
    table.integer('task_id');
    table.timestamps();
  }).then(function() {
    // Can't create this index using knex directly
    return knex.raw('CREATE UNIQUE INDEX UIX_thumbnails ' +
                    'on images (thumbnail_of, size)');
  });
};

exports.create_sessions = function() {
  return knex.schema.createTable('sessions', function(table) {
    table.string('sid').primary();
    table.text('sess');
  });
};

exports.add_all = function() {
  return Q.all([
    exports.create_users(),
    exports.create_tasks(),
    exports.create_task_status(),
    exports.create_images(),
    exports.create_emails(),
    exports.create_sessions()
  ]);
};
