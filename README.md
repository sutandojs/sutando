<div align="center">
  <img src="https://sutando.org/logo.svg" width="100" alt="Sutando logo" />
  <h1 align="center"><a href="https://sutando.org">Sutando</a></h1>
  <a href="https://www.npmjs.com/package/sutando"><img alt="NPM version" src="https://img.shields.io/npm/v/sutando.svg"></a>
  <a href="https://github.com/sutandojs/sutando/workflows/tests"><img alt="ci" src="https://github.com/sutandojs/sutando/workflows/tests/badge.svg"></a>
  <a href="https://github.com/sutandojs/sutando/blob/main/README.md"><img alt="GitHub" src="https://img.shields.io/github/license/sutandojs/sutando"></a>
  <br />
</div>


Sutando is an object-relational mapper (ORM) that makes it enjoyable to interact with your database. When using Sutando, each database table has a corresponding "Model" that is used to interact with that table. In addition to retrieving records from the database table, Sutando models allow you to insert, update, and delete records from the table as well. 

> Heavily inspired by Laravel's ORM [Eloquent](https://laravel.com/docs/10.x/eloquent).

## ✨ Features

- Supports MySQL, PostgreSQL, SQLite and other databases
- Concise syntax and intuitive operations
- Model relationships for handling complex data queries and operations
- Powerful query builder
- Customized data type conversion for model attributes
- Easy-to-use transaction
- Support for hooks to execute custom logic at different stages of model operations
- Simple plugin mechanism for easy expansion

## 📖 Documentation

Check the full documentation on [https://sutando.org](https://sutando.org) | [中文文档](https://sutando.org/zh_CN)

## 🚀 Quick Start

Let’s take mysql as an example.

Install Sutando and mysql database library

```sh
$ npm install sutando mysql2 --save
```

The easiest way to make SQL queries is to use the Database query builder. It allows you to construct simple and complex SQL queries using JavaScript methods.

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

// Query Builder
const users = await db.table('users').where('age', '>', 35).get();

// ORM
class User extends Model {}

// Query Data
const users = await User.query().where('age', '>', 35).get();

// Insert
const user = new User;
user.name = 'David Bowie';
await user.save();

// Delete
await user.delete();

// Pagination
const users = await User.query().paginate();

// Eager Loading
const users = await User.query().with('posts').get();

// Constraining Eager Loads
const users = await User.query().with({
  posts: q => q.where('likes_count', '>', 100)
}).get();

// Lazy Eager Loading
await user.load('posts');
```

## 💖 Show Your Support

Please ⭐️ this repository if this project helped you
