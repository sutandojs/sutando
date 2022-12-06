module.exports = {
  mysql: {
    client: 'mysql2',
    connection: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: 'root',
      password: process.env.MYSQL_PASSWORD || 'password',
      database: 'sutando_test',
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
  postgres: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'sutando',
      password: process.env.POSTGRES_PASSWORD || 'sutando',
      database: 'sutando_test',
    },
  }
}