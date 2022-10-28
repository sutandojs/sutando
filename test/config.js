module.exports = {
  mysql: {
    client: 'mysql2',
    connection: {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'test',
    },
    // pool: {
    //   afterCreate: (connection, callback) => {
    //     const asyncQuery = Promise.promisify(connection.query, {context: connection});
    //     return asyncQuery('SET SESSION sql_mode=?', ['TRADITIONAL,NO_AUTO_VALUE_ON_ZERO']).then(function() {
    //       callback(null, connection);
    //     });
    //   }
    // }
  },
  sqlite: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true,
  },
}