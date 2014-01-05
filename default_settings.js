
if (process.env.NODE_ENV == 'testing') {
  exports.database_client = 'sqlite';
  exports.database_connection = {
    filename: ':memory:'
  };

  // Run this function after databaes init
  exports.after_init = function() {
      var schema = require('./schema');
      return schema.add_all();
    };
} else {
  exports.database_client = 'pg';
  exports.database_connection = {
    user: 'tasks',
    password: '7852354546394752',
    database: 'tasks',
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    native: true
  };
  exports.hostname = '';
}
// Set to true in order to see all queries issued
exports.debug = false;
