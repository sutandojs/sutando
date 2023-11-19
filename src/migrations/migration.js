class Migration {
  connection;
  withinTransaction = true;

  getConnection() {
    return this.connection;
  }
}

module.exports = Migration;