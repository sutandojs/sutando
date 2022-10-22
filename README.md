<p align="center">
  <img src="https://sutando.org/logo.svg" width="100" alt="Sutando logo" />
  <h1 align="center"><a href="https://sutando.org">Sutando</a></h1>
</p>

Sutando is an object-relational mapper (ORM) that makes it enjoyable to interact with your database. When using Sutando, each database table has a corresponding "Model" that is used to interact with that table. In addition to retrieving records from the database table, Sutando models allow you to insert, update, and delete records from the table as well. 

> Heavily inspired by [Eloquent](https://laravel.com/docs/9.x/eloquent).

## docs

[https://sutando.org](https://sutando.org)

## Quick Started

Install Sutando and mysql database library

`npm install sutando mysql2 --save`
or
`yarn add sutando`
or
`pnpm add sutando`

The easiest way to make SQL queries is to use the Database query builder. It allows you to construct simple and complex SQL queries using JavaScript methods.

In the following example, we select all the posts from the users table.

```js
const { sutando, Model } = require('sutando');

// Add SQL Connection Info
sutando.addConnection({
  client: 'mysql2',
  connection: {
    host : '127.0.0.1',
    port : 3306,
    user : 'root',
    password : '',
    database : 'test'
  },
});

const db = sutando.connection();

// Using The Query Builder
const users = await db.table('users').where('votes', '>', 100).get();

// Using The Schema Builder
await sutando.schema().createTable('users', table => {
  table.increments('id').primary();
  table.integer('votes');
  table.timestamps();
});

// Using The ORM
class User extends Model {}
const users = await User.query().where('votes', '>', 100).get();
```