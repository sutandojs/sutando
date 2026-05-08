const { sutando, Model, Attribute } = require('../src');

describe('Accessor and Mutator same as field name', () => {
  beforeAll(async () => {
    sutando.addConnection({
      client: 'sqlite3',
      connection: {
        filename: ':memory:'
      },
      useNullAsDefault: true
    });

    await sutando.connection().schema.createTable('users', (table) => {
      table.increments('id');
      table.string('name');
      table.string('email');
    });
  });

  afterAll(async () => {
    await sutando.connection().destroy();
  });

  it('should work without appends when accessor name is same as field name', async () => {
    class User extends Model {
      attributeName() {
        return Attribute.make({
          get: (value) => value.toUpperCase(),
          set: (value) => value.toLowerCase()
        });
      }
    }

    const user = new User();
    user.name = 'Joe';
    expect(user.attributes.name).toBe('joe'); // Mutator should work
    expect(user.name).toBe('JOE'); // Accessor should work

    const data = user.toData();
    expect(data.name).toBe('JOE'); // toData should use accessor
  });

  it('should work without appends when getter name is same as field name', async () => {
    class User extends Model {
      getNameAttribute(value) {
        return value.toUpperCase();
      }
      setNameAttribute(value) {
        this.attributes.name = value.toLowerCase();
      }
    }

    const user = new User();
    user.name = 'Joe';
    expect(user.attributes.name).toBe('joe'); // Mutator should work
    expect(user.name).toBe('JOE'); // Accessor should work

    const data = user.toData();
    expect(data.name).toBe('JOE'); // toData should use accessor
  });
});
