const _ = require('lodash');
const { sutando, Model, Collection, Builder, Paginator, compose, SoftDeletes, Attribute } = require('../src');
const config = require(process.env.SUTANDO_CONFIG || './config');
const { ModelNotFoundError } = require('../src/errors');
const dayjs = require('dayjs');
const crypto = require('crypto');
const HasUniqueIds = require('../src/concerns/has-unique-ids');

Promise.delay = function (duration) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, duration)
  });
}

describe('Sutando', () => {
  it('should fail if passing a wrong connection info', () => {
    sutando.addConnection({
      client: 'abc',
      connection: {
        host : '127.0.0.1',
        port : 1234,
      }
    });
    expect(() => {
      sutando.connection();
    }).toThrow();
    sutando.connections = {};
  });
});

describe('Model', () => {
  const SomePlugin = (Model) => {
    return class extends Model {
      pluginAttribtue = 'plugin';
      pluginMethod() {
        return this.pluginAttribtue;
      }
    }
  }

  class User extends compose(
    Model,
    SomePlugin,
  ) {
    relationPost() {
      return this.hasMany(Post);
    }
  }

  class Post extends Model {
    relationAuthor() {
      return this.belongsTo(User);
    }

    relationTags() {
      return this.belongsToMany(Tag, 'post_tag');
    }

    relationThumbnail() {
      return this.belongsTo(Thumbnail, 'thumbnail_id');
    }
  }

  class Tag extends Model {
    relationPosts() {
      return this.belongsToMany(Post, 'post_tag');
    }
  }

  class Thumbnail extends Model {}
  class Media extends Model {}

  it('return the table name of the plural model name', () => {
    const user = new User;
    const media = new Media;
    expect(user.getTable()).toBe('users');
    expect(media.getTable()).toBe('media');
  });

  describe('#compose', () => {
    it('should return a Model instance', () => {
      const user = new User;
      expect(user).toBeInstanceOf(Model);
    });

    it('has mixin\'s attributes and methods', () => {
      const user = new User;
      expect(user.pluginAttribtue).toBe('plugin');
      expect(user.pluginMethod()).toBe('plugin');
    })
  })

  describe('#toData & #toJson', () => {
    class User extends Model {
      attributeFullName() {
        return Attribute.make({
          get: (value, attributes) => `${attributes.firstName} ${attributes.lastName}`,
          set: (value, attributes) => ({
            firstName: value.split(' ')[0],
            lastName: value.split(' ')[1]
          })
        })
      }
    }
    class Post extends Model {}

    let testModel;
    beforeEach(() => {
      testModel = new User({
        id: 1,
        firstName: 'Joe',
        lastName: 'Shmoe',
        address: '123 Main St.'
      });
    });

    it('includes the relations loaded on the model', () => {
      testModel.setRelation('posts', new Collection([
        new Post({id: 1}), new Post({id: 2})
      ]));
      
      const data = testModel.toData();

      expect(Object.keys(data)).toEqual(['id', 'firstName', 'lastName', 'address', 'posts']);
      expect(data.posts.length).toBe(2);
    });

    it('serializes correctly', () => {
      testModel.makeVisible('firstName');
      expect(testModel.toJson()).toBe('{"firstName":"Joe"}');
      expect(testModel.toString()).toBe('{"firstName":"Joe"}');
    });

    describe('#visible & #hidden', () => {
      it('only shows the fields specified in the model\'s "visible" property', () => {
        testModel.visible = ['firstName'];
        expect(testModel.toData()).toEqual({firstName: 'Joe'});
      });

      it('hides the fields specified in the model\'s "hidden" property', () => {
        expect(testModel.makeHidden('firstName').toData()).toEqual({id: 1, lastName: 'Shmoe', address: '123 Main St.'});
      });

      it('hides the fields specified in the "options.hidden" property', () => {
        testModel.makeHidden(['firstName', 'id']);
        expect(testModel.toData()).toEqual({lastName: 'Shmoe', address: '123 Main St.'});
      });

      it('prioritizes "hidden" if there are conflicts when using both "hidden" and "visible"', () => {
        testModel.makeVisible('firstName', 'lastName');
        testModel.makeHidden('lastName');
        expect(testModel.toData()).toEqual({ firstName: 'Joe' });
      });

      it('allows overriding the model\'s "hidden" property with a "makeHidden" argument', () => {
        testModel.hidden = ['lastName'];
        const data = testModel.makeHidden('firstName', 'id').toData();
        expect(data).toEqual({address: '123 Main St.'});
      });

      it('prioritizes "makeHidden" when overriding both the model\'s "hidden" and "visible" properties with "makeHidden" and "makeVisible" arguments', () => {
        testModel.visible = ['lastName', 'address'];
        testModel.hidden = ['address'];
        const data = testModel.makeVisible('firstName', 'lastName').makeHidden('lastName').toData();

        expect(data).toEqual({firstName: 'Joe'});
      });
    });

    it('model getter settings', () => {
      expect(testModel.full_name).toBe('Joe Shmoe');
    });

    it('model setter settings', () => {
      testModel.full_name = 'Bill Gates';
      expect(testModel.firstName).toBe('Bill');
      expect(testModel.lastName).toBe('Gates');
    });
  })

  describe('#isDirty', () => {
    it('returns true if an attribute was set on a new model instance', () => {
      const model = new Model({test: 'something'});
      expect(model.isDirty('test')).toBeTruthy();
    });

    it("returns false if the attribute isn't set on a new model instance", () => {
      const model = new Model({test_test: 'something'});
      // expect(model.getDirty()).toEqual({ a: 1})
      expect(model.isDirty('id')).toBeFalsy();
      expect(model.isDirty()).toBeTruthy();
    });

    it('returns true if an existing attribute is updated', () => {
      const model = new Model;
      model.test = 'something else';

      expect(model.isDirty('test')).toBeTruthy();
    });
  });
})

describe('Collection', () => {
  let collection;
  class User extends Model {
    primaryKey = 'some_id';
  }
  class Post extends Model {}

  beforeEach(() => {
    collection = new Collection([
      new User({some_id: 1, name: 'Test'}),
      new User({name: 'Test2'}),
      new Post({id: 2, name: 'Test3'})
    ]);
  });

  it('should initialize the items passed to the constructor', () => {
    expect(collection.count()).toBe(3);
    expect(collection.modelKeys()).toEqual([1, undefined, 2]);
    // expect(collection.get(1).getKey()).toBeUndefined();
  });

  it('should ', () => {
    expect(collection.toData()).toEqual([
      {some_id: 1, name: 'Test'},
      {name: 'Test2'},
      {id: 2, name: 'Test3'},
    ]);
  })
})

describe('Builder', () => {

})

describe('Paginator', () => {
  
})

describe('Integration test', () => {
  const databases = [
    // {
    //   client: 'postgres',
    //   connection: config.postgres
    // }
  ];

  if (process.argv.includes('--client=mysql')) {
    databases.push(config.mysql);
  } else if (process.argv.includes('--client=sqlite')) {
    databases.push(config.sqlite);
  } else if (process.argv.includes('--client=postgres')) {
    databases.push(config.postgres);
  }

  databases.map(config => {
    describe('Client: ' + config.client, () => {
      sutando.addConnection(config, config.client);
      const connection = sutando.connection(config.client);

      class Base extends Model {
        connection = config.client;
      }

      class Admin extends Base {
        table = 'administrators';
      }

      class User extends Base {
        hidden = ['password', 'remember_token'];
        
        attributeFullName() {
          return Attribute.make({
            get: (value, attributes) => `${attributes.firstName} ${attributes.name}`
          })
        }

        relationPosts() {
          return this.hasMany(Post);
        }
      }

      class UuidUser extends compose(Base, HasUniqueIds) {
        newUniqueId() {
          return crypto.randomUUID();
        }
      }

      class Post extends Base {
        scopePublish(query) {
          return query.where('status', 1);
        }

        relationAuthor() {
          return this.belongsTo(User);
        }

        relationDefaultAuthor() {
          return this.belongsTo(User).withDefault({
            name: 'Default Author'
          });
        }

        relationDefaultPostAuthor() {
          return this.belongsTo(User).withDefault((user, post) => {
            user.name = post.name + ' - Default Author';
          });
        }

        relationThumbnail() {
          return this.belongsTo(Media, 'thumbnail_id');
        }

        relationMedia() {
          return this.belongsToMany(Media);
        }

        relationTags() {
          return this.belongsToMany(Tag);
        }

        relationComments() {
          return this.hasMany(Comment);
        }
      }

      class Tag extends Base {
        relationPosts() {
          return this.belongsToMany(Post);
        }
      }

      class Comment extends Base {}

      class Media extends Base {}

      class SoftDeletePost extends compose(Base, SoftDeletes) {}

      beforeAll(() => {
        return Promise.all(['users', 'tags', 'posts', 'post_tag', 'administrators', 'comments', 'media'].map(table => {
          return connection.schema.dropTableIfExists(table);
        })).then(() => {
          return connection.schema
            .createTable('users', (table) => {
              table.increments('id');
              table.string('name');
              table.string('first_name');
              table.timestamps();
            })
            .createTable('uuid_users', (table) => {
              table.string('id').primary();
              table.string('name');
              table.timestamps();
            })
            .createTable('media', (table) => {
              table.increments('id');
              table.integer('mediaable_id').defaultTo(0);
              table.string('mediaable_type').defaultTo('');
              table.string('uuid').defaultTo('');
              table.timestamps();
            })
            .createTable('tags', (table) => {
              table.increments('id');
              table.string('name');
              table.timestamps();
            })
            .createTable('administrators', (table) => {
              table.increments('id');
              table.string('username');
              table.string('password');
              table.timestamps();
            })
            .createTable('posts', (table) => {
              table.increments('id');
              table.integer('user_id').defaultTo(0);
              table.string('name');
              table.text('content');
              table.timestamps();
            })
            .createTable('post_tag', (table) => {
              table.increments('id');
              table.integer('post_id').defaultTo(0);
              table.integer('tag_id').defaultTo(0);
              table.timestamps();

            })
            .createTable('comments', function(table) {
              table.increments('id');
              table.integer('post_id').defaultTo(0);
              table.string('name');
              table.string('email');
              table.text('comment');
              table.timestamps();
            })
            .createTable('soft_delete_posts', function(table) {
              table.increments('id');
              table.string('name');
              table.text('content');
              table.datetime('deleted_at').defaultTo(null);
              table.timestamps();
            })
        }).then(() => {
          const date = dayjs().format('YYYY-MM-DD HH:mm:ss');
          return Promise.all([
            connection.table('users').insert([
              {
                first_name: 'Tim',
                name: 'Shuri',
                created_at: date,
                updated_at: date,
              },
              {
                first_name: 'X',
                name: 'Alice',
                created_at: date,
                updated_at: date,
              }
            ]),
            // connection.table('uuid_users').insert([]),
            connection.table('administrators').insert([
              {
                username: 'test1',
                password: 'testpwd1',
                created_at: date,
                updated_at: date
              },
              {
                username: 'test2',
                password: 'testpwd2',
                created_at: date,
                updated_at: date
              }
            ]),
            connection.table('post_tag').insert([
              {
                post_id: 1,
                tag_id: 1,
                created_at: date,
                updated_at: date
              },
              {
                post_id: 1,
                tag_id: 2,
                created_at: date,
                updated_at: date
              },
              {
                post_id: 1,
                tag_id: 3,
                created_at: date,
                updated_at: date
              },
              {
                post_id: 4,
                tag_id: 1,
                created_at: date,
                updated_at: date
              }
            ]),
            connection.table('comments').insert([
              {
                post_id: 3,
                name: '(blank)',
                email: 'test@example.com',
                comment: 'this is neat.',
                created_at: date,
                updated_at: date
              }
            ]),
            connection.table('tags').insert([
              {
                name: 'cool',
                created_at: date,
                updated_at: date
              },
              {
                name: 'boring',
                created_at: date,
                updated_at: date
              },
              {
                name: 'exciting',
                created_at: date,
                updated_at: date
              },
              {
                name: 'amazing',
                created_at: date,
                updated_at: date
              }
            ]),
            connection.table('posts').insert([
              {
                user_id: 1,
                name: 'This is a new Title!',
                content:
                  'Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.',
                created_at: date,
                updated_at: date
              },
              {
                user_id: 2,
                name: 'This is a new Title 2!',
                content:
                  'Lorem ipsum Veniam ex amet occaecat dolore in pariatur minim est exercitation deserunt Excepteur enim officia occaecat in exercitation aute et ad esse ex in in dolore amet consequat quis sed mollit et id incididunt sint dolore velit officia dolor dolore laboris dolor Duis ea ex quis deserunt anim nisi qui culpa laboris nostrud Duis anim deserunt esse laboris nulla qui in dolor voluptate aute reprehenderit amet ut et non voluptate elit irure mollit dolor consectetur nisi adipisicing commodo et mollit dolore incididunt cupidatat nulla ut irure deserunt non officia laboris fugiat ut pariatur ut non aliqua eiusmod dolor et nostrud minim elit occaecat commodo consectetur cillum elit laboris mollit dolore amet id qui eiusmod nulla elit eiusmod est ad aliqua aute enim ut aliquip ex in Ut nisi sint exercitation est mollit veniam cupidatat adipisicing occaecat dolor irure in aute aliqua ullamco.',
                created_at: date,
                updated_at: date
              },
              {
                user_id: 2,
                name: 'This is a new Title 3!',
                content: 'Lorem ipsum Reprehenderit esse esse consectetur aliquip magna.',
                created_at: date,
                updated_at: date
              },
              {
                user_id: 30,
                name: 'This is a new Title 4!',
                content: 'Lorem ipsum Anim sed eu sint aute.',
                created_at: date,
                updated_at: date
              },
              {
                user_id: 4,
                name: 'This is a new Title 5!',
                content:
                  'Lorem ipsum Commodo consectetur eu ea amet laborum nulla eiusmod minim veniam ullamco nostrud sed mollit consectetur veniam mollit Excepteur quis cupidatat.',
                created_at: date,
                updated_at: date
              }
            ]),
            connection.table('soft_delete_posts').insert([
              {
                name: 'This is a new Title!',
                content:
                  'Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.',
                created_at: date,
                updated_at: date,
                deleted_at: null,
              },
              {
                name: 'This is a new Title 2!',
                content:
                  'Lorem ipsum Veniam ex amet occaecat dolore in pariatur minim est exercitation deserunt Excepteur enim officia occaecat in exercitation aute et ad esse ex in in dolore amet consequat quis sed mollit et id incididunt sint dolore velit officia dolor dolore laboris dolor Duis ea ex quis deserunt anim nisi qui culpa laboris nostrud Duis anim deserunt esse laboris nulla qui in dolor voluptate aute reprehenderit amet ut et non voluptate elit irure mollit dolor consectetur nisi adipisicing commodo et mollit dolore incididunt cupidatat nulla ut irure deserunt non officia laboris fugiat ut pariatur ut non aliqua eiusmod dolor et nostrud minim elit occaecat commodo consectetur cillum elit laboris mollit dolore amet id qui eiusmod nulla elit eiusmod est ad aliqua aute enim ut aliquip ex in Ut nisi sint exercitation est mollit veniam cupidatat adipisicing occaecat dolor irure in aute aliqua ullamco.',
                created_at: date,
                updated_at: date,
                deleted_at: date
              },
              {
                name: 'This is a new Title 3!',
                content:
                  'Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.',
                created_at: date,
                updated_at: date,
                deleted_at: null,
              },
              {
                name: 'This is a new Title 4!',
                content:
                  'Lorem ipsum Veniam ex amet occaecat dolore in pariatur minim est exercitation deserunt Excepteur enim officia occaecat in exercitation aute et ad esse ex in in dolore amet consequat quis sed mollit et id incididunt sint dolore velit officia dolor dolore laboris dolor Duis ea ex quis deserunt anim nisi qui culpa laboris nostrud Duis anim deserunt esse laboris nulla qui in dolor voluptate aute reprehenderit amet ut et non voluptate elit irure mollit dolor consectetur nisi adipisicing commodo et mollit dolore incididunt cupidatat nulla ut irure deserunt non officia laboris fugiat ut pariatur ut non aliqua eiusmod dolor et nostrud minim elit occaecat commodo consectetur cillum elit laboris mollit dolore amet id qui eiusmod nulla elit eiusmod est ad aliqua aute enim ut aliquip ex in Ut nisi sint exercitation est mollit veniam cupidatat adipisicing occaecat dolor irure in aute aliqua ullamco.',
                created_at: date,
                updated_at: date,
                deleted_at: date
              },
            ]),
          ])
        });
      });

      afterAll(() => {
        connection.destroy();
      })

      describe('Model', () => {
        it('should return a same instance', () => {
          expect(connection).toBe(sutando.connection(config.client));
        });

        it('should return a Builder instance', () => {
          expect(User.query()).toBeInstanceOf(Builder);
        });

        describe('first', () => {
          it('should create a new model instance', async () => {
            const user = await User.query().first();
    
            expect(user.getTable()).toBe('users');
            expect(user).toBeInstanceOf(User);
            expect(user).toBeInstanceOf(Model);
          });
        });

        describe('query', () => {
          let model;
    
          beforeEach(() => {
            model = new User;
          });
    
          it('returns the Builder when no arguments are passed', () => {
            expect(User.query()).toBeInstanceOf(Builder);
          });
    
          it('calls builder method with the first argument, returning the model', () => {
            const query = User.query();
            const q = query.where('id', 1);
            expect(q).toStrictEqual(query);
          });
    
          it('allows passing an object to query', () => {
            const query = User.query();
            expect(_.filter(query.query._statements, {grouping: 'where'}).length).toBe(0);
            
            const q = query.where('id', 1).orWhere('id', '>', 10);
            expect(q).toStrictEqual(query);
            expect(_.filter(query.query._statements, {grouping: 'where'}).length).toBe(2);
          });
    
          it('allows passing a function to query', () => {
            const query = User.query();
            expect(_.filter(query.query._statements, {grouping: 'where'}).length).toBe(0);
    
            const q = query.where((q) => {
              q.where('id', 1).orWhere('id', '>', '10');
            });
            
            expect(q).toEqual(query);
            expect(_.filter(query.query._statements, {grouping: 'where'}).length).toBe(1);
          });
        });

        describe('#first() & #find()', () => {
          it('issues a first (get one), triggering a fetched event, returning a promise', () => {
            const query = User.query().where('id', 1);

            return query.first().then((user) => {
              expect(user).toBeInstanceOf(User);
              expect(user.id).toBe(1);
              expect(user.name).toBe('Shuri');
            });
          });
    
          it('allows specification of select columns in query', () => {
            return User.query().where('id', 1).select(['id', 'first_name']).first().then((user) => {
              expect(user.toData()).toEqual({id: 1, first_name: 'Tim'});
            });
          });
    
          it('resolves to null if no record exists and the {require: false} option is passed', () => {
            return User.query().where('id', 200).first().then(user => {
              expect(user).toBeNull();
            })
          });
    
          it('rejects with an error if no record exists', () => {
            return User.query().where('id', 200).firstOrFail().then(user => {
              // expect(user).toBeNull();
            }).catch(e => {
              expect(e).toBeInstanceOf(ModelNotFoundError);
            });
          });
    
          it('locks the table when called with the forUpdate option during a transaction', async () => {
            let userId;

            const user = new User;
            user.first_name = 'foo';
            await user.save();

            userId = user.id;

            await Promise.all([
              connection.transaction(trx => {
                return User.query(trx).forUpdate().find(user.id)
                .then(() => {
                  return Promise.delay(100);
                })
                .then(() => {
                  return User.query(trx).find(user.id);
                })
                .then(user => {
                  expect(user.first_name).toBe('foo');
                });
              }),
              Promise.delay(25).then(() => {
                return User.query().where('id', user.id).update({
                  first_name: 'changed',
                });
              })
            ]);

            await User.query().where('id', userId).delete();
          });
    
          it('locks the table when called with the forShare option during a transaction', () => {
            let userId;
            const user = new User({ first_name: 'foo'});

            return user.save()
              .then(() => {
                userId = user.id;

                return Promise.all([
                  connection.transaction(trx => {
                    return User.query(trx).forShare().find(user.id)
                      .then(() => Promise.delay(100))
                      .then(() => User.query(trx).find(user.id))
                      .then(user => {
                        expect(user.first_name).toBe('foo');
                      })
                  }),
                  Promise.delay(60).then(() => {
                    return User.query().where('id', user.id).update({
                      first_name: 'changed',
                    });
                  })
                ])
              })
              .then(() => {
                return User.query().where('id', userId).delete()
              });
          });
        });

        describe('#get()', () => {
          it('should merge models with duplicate ids by default', async () => {
            const users = await User.query().get();

            expect(users).toBeInstanceOf(Collection);
            expect(users.count()).toBe(2);
            expect(users.pluck('name').all()).toEqual(['Shuri', 'Alice']);
          });
    
          it('returns an empty collection if there are no results', async () => {
            const users = await User.query()
              .where('name', 'hal9000')
              .get();

            expect(users).toBeInstanceOf(Collection);
            expect(users.count()).toBe(0);
          });
        });

        describe('#chunk()', () => {
          it('fetches a single page of results with defaults', async () => {
            const names = [];

            await Tag.query().chunk(2, (tags) => {
              tags.map(tag => {
                names.push(tag.name);
              });
            });

            expect(names).toEqual(['cool', 'boring', 'exciting', 'amazing']);

            await Tag.query().orderBy('id', 'desc').chunk(2, (tags) => {
              tags.map(tag => {
                names.push(tag.name);
              });
            });

            expect(names).toEqual(['cool', 'boring', 'exciting', 'amazing', 'amazing', 'exciting', 'boring', 'cool']);
          });
        });

        describe('#paginate()', () => {
          it('fetches a single page of results with defaults', () => {
            return User.query().paginate()
              .then((users) => {
                expect(users).toBeInstanceOf(Paginator);
              });
          });
    
          it('returns an empty collection if there are no results', () => {
            return Comment.query().delete()
              .then(() => Comment.query().paginate())
              .then(results => {
                expect(results).toBeInstanceOf(Paginator);
                expect(results.count()).toBe(0);
              });
          });
    
          it('fetches a page of results with specified page size', () => {
            return User.query().paginate(1, 2)
              .then((results) => {
                expect(results).toBeInstanceOf(Paginator);
                expect(results.count()).toBe(2);
                expect(results.total()).toBe(2);
                expect(results.currentPage()).toBe(1);
              });
          });
    
          it('fetches a page by page number', () => {
            return User.query().orderBy('id', 'asc').paginate(1, 2)
              .then((results) => {
                expect(results.get(0).id).toBe(1);
                expect(results.get(1).id).toBe(2);
              });
          });
    
          describe('inside a transaction', () => {
            it('returns consistent results for rowCount and number of models', async () => {
              // await Post.query().insert({
              //   user_id: 0,
              //   name: 'a new post'
              // });
              return connection.transaction(async trx => {
                await Post.query(trx).insert({
                  user_id: 0,
                  name: 'a new post'
                });
                
                const posts = await Post.query(trx).paginate(1, 25);
                expect(posts.total()).toBe(posts.count());
              });
            });
          });
    
          describe('with groupBy', () => {
            it('counts grouped rows instead of total rows', () => {
              let total;

              return Post.query().count().then(count => {
                total = parseInt(count);

                return Post.query()
                  // .max('id')
                  .select('user_id')
                  .groupBy('user_id')
                  .whereNotNull('user_id')
                  .paginate();
              }).then(posts => {
                expect(posts.count()).toBeLessThanOrEqual(total);
              });
            });
    
            it('counts grouped rows when using table name qualifier', () => {
              let total;

              Post.query().count()
                .then(count => {
                  total = parseInt(count, 10);

                  return Post.query()
                    // .max('id')
                    .select('user_id')
                    .groupBy('posts.user_id')
                    .whereNotNull('user_id')
                    .paginate();
                })
                .then(posts => {
                  expect(posts.count()).toBeLessThanOrEqual(total);
                });
            });
          });
    
          describe('with distinct', () => {
            it('counts distinct occurences of a column instead of total rows', () => {
              let total;

              return Post.query().count()
                .then(count => {
                  total = count;
                  return Post.query().distinct('user_id').get();
                })
                .then(distinctPostUsers => {
                  expect(distinctPostUsers.count()).toBeLessThanOrEqual(total);
                });
            });
          });
        });

        describe('orderBy', () => {
          it('returns results in the correct order', () => {
            const asc = User.query()
              .orderBy('id', 'asc')
              .get()
              .then(result => {
                return result.pluck('id').all();
              });

            const desc = User.query()
              .orderBy('id', 'desc')
              .get()
              .then(result => {
                return result.pluck('id').all();
              });
    
            return Promise.all([asc, desc]).then((results) => {
              expect(results[0].reverse()).toEqual(results[1]);
            });
          });

          // it('randomly sorts results', async () => {
          //   let post1 = await Post.query().oldest().first();
          //   let post2 = await Post.query().oldest().first();
          //   let post3 = await Post.query().oldest().first();
          //   let post4 = await Post.query().oldest().first();

          //   expect(post1.is(post2) && post2.is(post3) && post3.is(post4)).toBe(true);

          //   post1 = await Post.query().inRandomOrder().first();
          //   post2 = await Post.query().inRandomOrder().first();
          //   post3 = await Post.query().inRandomOrder().first();
          //   post4 = await Post.query().inRandomOrder().first();

          //   expect(post1.is(post2) && post2.is(post3) && post3.is(post4)).toBe(false);
          // })
        });

        describe('#save()', () => {
          it('saves a new object', async () => {
            const post = new Post;
            post.user_id = 0;
            post.name = 'Fourth post';
            await post.save();

            expect(Number(post.id)).toBe(7);

            const posts = await Post.query().get();
            expect(posts.last().id).toBe(7);
            expect(posts.last().name).toBe('Fourth post');
            expect(posts.count()).toBe(7);
          });

          it('saves a new object with unique id', async () => {
            const pattern = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;

            const user = new UuidUser;
            user.name = 'Joey';
            await user.save();

            expect(pattern.test(user.id)).toBe(true);

            const uuser = await UuidUser.query().first();
            expect(uuser.name).toBe('Joey');
            expect(uuser.id).toBe(user.id);
          });
    
    
          it('saves all attributes that are currently set on the model plus the ones passed as argument', async () => {
            const post = new Post({
              name: 'A Cool Blog',
            });
            post.user_id = 1;

            await post.save();
            expect(post.toData()).toHaveProperty('name', 'A Cool Blog');
            expect(post.toData()).toHaveProperty('user_id', 1);

            await post.refresh();
            expect(post.toData()).toHaveProperty('name', 'A Cool Blog');
            expect(post.toData()).toHaveProperty('user_id', 1);

            await post.delete();
          });
    
          it('updates an existing object', () => {
            return (Post.query().where('id', 5).update({name: 'Fourth Post Updated'}))
              .then(() => {
                return Post.query().where('name', 'Fourth Post Updated').get();
              })
              .then(posts => {
                expect(posts.last().id).toBe(5);
                expect(posts.all()).toHaveLength(1);
              });
          });
    
          it('allows passing a method to save, to call insert or update explicitly', () => {
            return Post.query().insert({
              user_id: 0,
              name: 'Fifth post, explicity created'
            })
              .then(() => {
                return Post.query().all();
              })
              .then(posts => {
                expect(posts.count()).toBe(8);
                expect(posts.last().id).toBe(9);
              });
          });
    
          // it('should error if updated row was not affected', async () => {
          //   return await expect(Post.query().insert({
          //     id: 7,
          //     user_id: 0,
          //     name: 'Fifth post, explicity created'
          //   })).rejects.toThrow();
          // });
        });

        describe('#delete()', () => {
          it('issues a delete to the builder, returning a promise', () => {
            return Post.query().where('id', 5)
              .delete()
              .then(() => {
                return Post.query().all();
              })
              .then(posts => {
                expect(posts.count()).toBe(7);
              })
          });
    
          it('will not throw an error when trying to delete a non-existent object', () => {
            return Post.query().where('id', 1024).delete().then(count => {
              expect(count).toBe(0);
            });
          });
        });

        describe('#count()', () => {
          it('counts the number of models in a collection', () => {
            return Post.query().count()
              .then(count => {
                expect(count).toBe(7);
              });
          });
    
          it('counts a filtered query', () => {
            return Post.query().where('user_id', 1).count()
              .then(count => {
                expect(count).toBe(1)
              })
          });
        });

        describe('timestamps', () => {
          describe('Date value', () => {
            let admin;
    
            beforeEach(() => {
              admin = new Admin;
              admin.username = 'a_new_user';
              return admin.save();
            });
    
            afterEach(() => {
              return admin.delete();
            });
    
            it('is the same between saving and fetching models', async () => {
              const newAdmin = await Admin.query().find(admin.id);
              expect(dayjs(newAdmin.created_at)).toEqual(dayjs(admin.created_at));
              expect(dayjs(newAdmin.updated_at)).toEqual(dayjs(admin.updated_at));
            });
    
            it('is the same between saving and fetching all models', () => {
              return Admin.query()
                .where('id', admin.id)
                .get()
                .then(admins => {
                  expect(dayjs(admins.get(0).created_at)).toEqual(dayjs(admin.created_at));
                  expect(dayjs(admins.get(0).updated_at)).toEqual(dayjs(admin.updated_at));
                });
            });
    
            it('is the same after updating model', () => {
              admin.username = 'updated_user';
              return admin.save()
                .then(() => {
                  return Admin.query().find(admin.id);
                })
                .then(newAdmin => {
                  expect(dayjs(newAdmin.created_at)).toEqual(dayjs(admin.created_at));
                  expect(dayjs(newAdmin.updated_at)).toEqual(dayjs(admin.updated_at));
                });
            });
          });
    
          describe('On update', () => {
            it('will set the updated_at timestamp to the user supplied value', () => {
              const admin = new Admin;
              let oldUpdatedAt;
              const newUpdatedAt = '2022-02-02 12:13:14';

              return admin.save()
                .then(() => {
                  oldUpdatedAt = dayjs(admin.updated_at).format('YYYY-MM-DD HH:mm:ss');
                  admin.updated_at = newUpdatedAt;
                  return admin.save();
                })
                .then(() => {
                  expect(dayjs(admin.updated_at).format('YYYY-MM-DD HH:mm:ss')).toEqual(newUpdatedAt);
                  expect(dayjs(admin.updated_at).format('YYYY-MM-DD HH:mm:ss')).not.toEqual(oldUpdatedAt);
                });
            });
    
            it('will set the created_at timestamp to the user supplied value', () => {
              const admin = new Admin;
              let oldCreatedAt;
              const newCreatedAt = '2022-02-02 12:13:14';

              return admin.save()
                .then(() => {
                  oldCreatedAt = dayjs(admin.created_at).format('YYYY-MM-DD HH:mm:ss');
                  admin.created_at = newCreatedAt;
                  return admin.save();
                })
                .then(() => {
                  const create_at = dayjs(admin.created_at).format('YYYY-MM-DD HH:mm:ss');
                  expect(create_at).toEqual(newCreatedAt);
                  expect(create_at).not.toEqual(oldCreatedAt);
                });
            });
          });
    
          describe('On insert', () => {
            let model;
    
            beforeEach(() => {
              model = new User;
            });
    
            it('sets created_at and updated_at when is passed as option', () => {
              return model.save()
                .then(() => {
                  expect(model.create_at).not.toBeNaN();
                  expect(model.updated_at).not.toBeNaN();
                });
            });
    
            it("sets created_at to the user specified value if present in the model's attributes", () => {
              const date = '1999-01-01 01:01:01';
              model.created_at = date;
              return model.save()
                .then(() => {
                  expect(dayjs(model.created_at).format('YYYY-MM-DD HH:mm:ss')).toBe(date);
                });
            });
    
            it("sets updated_at to the user specified value if present in the model's attributes", () => {
              const date = '1999-01-01 01:01:01';
              model.updated_at = date;
              return model.save()
                .then(() => {
                  expect(dayjs(model.updated_at).format('YYYY-MM-DD HH:mm:ss')).toBe(date);
                });
            });
          });
        });

        describe('exists', () => {
          it('uses the id to determine if the model exists', async () => {
            const user = new User;
            expect(user.exists).toBeFalsy();

            user.name = 'new_user';
            await user.save();
            expect(user.exists).toBeTruthy();

            const newUser = await User.query().find(user.id);
            expect(newUser.exists).toBeTruthy();
          });
        });

        describe('#isDirty()', () => {
          it('returns true if passing an attribute name that has changed since the last sync', async () => {
            const user = await User.query().first();
            user.name = 'changed name';
            expect(user.isDirty('name')).toBe(true);
          });
    
          it('returns false if passing an attribute name that has not changed since the last sync', async () => {
            const user = await User.query().first();
            user.name = 'changed name';
            expect(user.isDirty('id')).toBe(false);
          });
    
          it('returns true if no arguments are provided and an attribute of the model has changed', async () => {
            const user = await User.query().first();
            user.name = 'changed name';
            expect(user.isDirty()).toBe(true);
          });
    
          it("returns false if no arguments are provided and the model hasn't changed", async () => {
            const user = await User.query().first();
            expect(user.isDirty()).toBe(false);
          });
    
          it('returns false after an attribute is changed and the model is saved', async () => {
            let originalName;

            const post = await Post.query().first();
            originalName = post.name;
            post.name = 'changed name';
            await post.save();
            expect(post.isDirty()).toBe(false);

            if (originalName) {
              await Post.query().insert({
                user_id: 0,
                name: originalName
              });
            }
          });
        });

        describe('#soft-delete', () => {
          // new SoftDeletePost;
          it('#count', async () => {
            const count = await SoftDeletePost.query().count()
            expect(count).toBe(2);
            
            const withTrashedCount = await SoftDeletePost.query().withTrashed().count();
            expect(withTrashedCount).toBe(4);

            const onlyTrashedCount = await SoftDeletePost.query().onlyTrashed().count();
            expect(onlyTrashedCount).toBe(2);
          });

          it('#trashed()', async () => {
            const posts = await SoftDeletePost.query().withTrashed().get();
            expect(posts.count()).toBe(4);
            expect(posts.find(1).trashed()).toBe(false);
            expect(posts.find(2).trashed()).toBe(true);
          });

          it('#delete()', async () => {
            await SoftDeletePost.query().where('id', 1).delete();
            const count = await SoftDeletePost.query().count();
            expect(count).toBe(1);

            const post = await SoftDeletePost.query().first();
            expect(post.id).toBe(3);
            await post.delete();
            expect(post.trashed()).toBe(true);
          });

          it('#restore', async () => {
            await SoftDeletePost.query().withTrashed().whereIn('id', [1, 2]).restore();
            let count = await SoftDeletePost.query().count();
            expect(count).toBe(2);

            const post = await SoftDeletePost.query().withTrashed().where('id', 3).first();
            await post.restore();
            expect(post.trashed()).toBe(false);

            count = await SoftDeletePost.query().count();
            expect(count).toBe(3);
          });

          it('#forceDelete()', async () => {
            await SoftDeletePost.query().where('id', 1).forceDelete();
            let count = await SoftDeletePost.query().count();
            expect(count).toBe(2);

            const post = await SoftDeletePost.query().withTrashed().first();
            await post.forceDelete();

            count = await SoftDeletePost.query().withTrashed().count();
            expect(count).toBe(2);
          });
        })
      });

      describe('Relation', () => {
        describe('Standard Relations', () => {
          it('handles belongsTo', async () => {
            const post = await Post.query().find(1);
            const author = await post.related('author').first();
            expect(author).toBeInstanceOf(User);
            expect(author.id).toBe(post.user_id);
          });
  
          it('handles hasMany (posts)', async () => {
            const user = await User.query().find(1);
            const posts = await user.related('posts').get();

            expect(posts).toBeInstanceOf(Collection);

            posts.map(post => {
              expect(user.id).toBe(post.user_id);
            });
          });

          it('handles has/whereHas query', async () => {
            let count = await User.query().has('posts').count();
            expect(count).toBe(2);

            count = await User.query().has('posts', '>', 1).count();
            expect(count).toBe(1);

            count = await User.query().whereHas('posts', (q) => {
              return q.where('name', '=', 'This is a new Title 3!');
            }).count();
            expect(count).toBe(1);

            // count = await User.query().whereExists((q) => {
            //   q.select('*').from('posts').whereColumn('posts.user_id', 'users.id')
            // }).count();

            // expect(count).toBe(2);
          });

          it('handles whereRelation', async () => {
            let count = await User.query().whereRelation('posts', 'name', '=', 'This is a new Title 3!').count();
            expect(count).toBe(1);

            count = await User.query().whereRelation('posts', 'name', '=', 'This is a new Title 6!').count();
            expect(count).toBe(0);
          });
        });

        describe('Eager Loading', () => {
          it('eager loads "hasOne" relationships correctly', async () => {
            return Post.query().with('thumbnail').find(1)
              .then(post => {
                const xpost = post.toData();
                _.unset(xpost, 'created_at');
                _.unset(xpost, 'updated_at');
                expect(xpost).toEqual({"content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "thumbnail": null, "user_id": 1});
              });
          });
  
          it('does not load "hasOne" relationship when it doesn\'t exist', () => {
            return Post.query().with('thumbnail').find(3)
              .then(post => {
                expect(post.toData().thumbnail).toBeNull();
              });
          });
  
          it('eager loads "hasMany" relationships correctly', () => {
            return User.query().with('posts').find(1)
              .then(user => {
                const xuser = user.toData();
                _.unset(xuser, 'created_at');
                _.unset(xuser, 'updated_at');
                xuser.posts.forEach(post => {
                  _.unset(post, 'created_at');
                  _.unset(post, 'updated_at');
                })
                expect(xuser).toEqual({"first_name": "Tim", "id": 1, "name": "Shuri", "posts": [{"content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "user_id": 1}]});
              });
          });
  
          it('eager loads "belongsTo" relationships correctly', () => {
            return Post.query().with('author').find(1)
              .then(post => {
                const author = post.toData().author;
                _.unset(author, 'created_at');
                _.unset(author, 'updated_at');
                expect(author).toEqual({
                  "first_name": "Tim", "id": 1, "name": "Shuri",
                });
              });
          });
  
          it('does not load "belongsTo" relationship when foreignKey is null', () => {
            return Post.query().with('author').find(4)
              .then(post => {
                expect(post.toData().author).toBeNull();
              });
          });

          it('eager loads "belongsTo" relationship with default values', async () => {
            let post = await Post.query().with('default_author').find(4);
            let xpost = post.toData();
            _.unset(xpost, 'created_at');
            _.unset(xpost, 'updated_at');

            expect(post.default_author).toBeInstanceOf(User);
            expect(xpost).toEqual({
              id: 4,
              user_id: 30,
              name: 'This is a new Title 4!',
              content: 'Lorem ipsum Anim sed eu sint aute.',
              default_author: {
                name: 'Default Author'
              }
            });

            post = await Post.query().with('default_post_author').find(4);
            xpost = post.toData();
            _.unset(xpost, 'created_at');
            _.unset(xpost, 'updated_at');

            expect(post.default_post_author).toBeInstanceOf(User);
            expect(xpost).toEqual({
              id: 4,
              user_id: 30,
              name: 'This is a new Title 4!',
              content: 'Lorem ipsum Anim sed eu sint aute.',
              default_post_author: {
                name: 'This is a new Title 4! - Default Author'
              }
            });
          });

          it('eager loads "belongsToMany" models correctly', () => {
            return Post.query().with('tags').find(1)
              .then(post => {
                const xpost = post.toData();
                _.unset(xpost, 'created_at');
                _.unset(xpost, 'updated_at');
                xpost.tags.forEach(tag => {
                  _.unset(tag, 'created_at');
                  _.unset(tag, 'updated_at');
                })

                expect(xpost).toEqual({
                  "content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "tags": [{"id": 1, "name": "cool", "pivot": {"post_id": 1, "tag_id": 1}}, {"id": 2, "name": "boring", "pivot": {"post_id": 1, "tag_id": 2}}, {"id": 3, "name": "exciting", "pivot": {"post_id": 1, "tag_id": 3}}], "user_id": 1
                });
              });
          });
  
          it('maintains eager loaded column specifications', () => {
            return Post.query().with({
              author: q => q.select('id', 'name'),
            }).find(1)
              .then(post => {
                const xpost = post.toData();
                _.unset(xpost, 'created_at');
                _.unset(xpost, 'updated_at');
                expect(xpost).toEqual({
                  "author": {"id": 1, "name": "Shuri"}, "content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "user_id": 1
                });
              });
          });

          it('maintains eager loaded column specifications by string', () => {
            return Post.query().with('author:id,name').find(1)
              .then(post => {
                const xpost = post.toData();
                _.unset(xpost, 'created_at');
                _.unset(xpost, 'updated_at');
                expect(xpost).toEqual({"author": {"id": 1, "name": "Shuri"}, "content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "user_id": 1});
              });
          });
  
          it('throws an error on undefined first withRelated relations', async () => {
            await expect(Post.query().with('undefinedRelation').find(1)).rejects.toThrow();
          });
  
          it('throws an error on undefined non-first withRelated relations', async () => {
            await expect(Post.query().with(['author', 'undefinedRelation']).find(1)).rejects.toThrow();
          });
        });

        describe('Nested Eager Loading', () => {
          it('eager loads "hasMany" -> "belongsToMany"', () => {
            return User.query().with('posts.tags').first()
              .then(user => {
                const xuser = user.toData();
                _.unset(xuser, 'created_at');
                _.unset(xuser, 'updated_at');
                xuser.posts.forEach(post => {
                  _.unset(post, 'created_at');
                  _.unset(post, 'updated_at');
                  post.tags.forEach(tag => {
                    _.unset(tag, 'created_at');
                    _.unset(tag, 'updated_at');
                  })
                })

                expect(xuser).toEqual({"first_name": "Tim", "id": 1, "name": "Shuri", "posts": [{"content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "tags": [{"id": 1, "name": "cool", "pivot": {"post_id": 1, "tag_id": 1}}, {"id": 2, "name": "boring", "pivot": {"post_id": 1, "tag_id": 2}}, {"id": 3, "name": "exciting", "pivot": {"post_id": 1, "tag_id": 3}}], "user_id": 1}]});
              });
          });
  
          it('does multi deep eager loads', () => {
            return User.query().with({
              'posts.tags': q => q.orderBy('tags.id', 'desc'),
            }, 'posts.thumbnail').first()
              .then(user => {
                const xuser = user.toData();
                _.unset(xuser, 'created_at');
                _.unset(xuser, 'updated_at');
                xuser.posts.forEach(post => {
                  _.unset(post, 'created_at');
                  _.unset(post, 'updated_at');
                  post.tags.forEach(tag => {
                    _.unset(tag, 'created_at');
                    _.unset(tag, 'updated_at');
                  })
                })
                expect(xuser).toEqual({"first_name": "Tim", "id": 1, "name": "Shuri", "posts": [{"content": "Lorem ipsum Labore eu sed sed Excepteur enim laboris deserunt adipisicing dolore culpa aliqua cupidatat proident ea et commodo labore est adipisicing ex amet exercitation est.", "id": 1, "name": "changed name", "tags": [{"id": 3, "name": "exciting", "pivot": {"post_id": 1, "tag_id": 3}}, {"id": 2, "name": "boring", "pivot": {"post_id": 1, "tag_id": 2}}, {"id": 1, "name": "cool", "pivot": {"post_id": 1, "tag_id": 1}}], "thumbnail": null, "user_id": 1}]});
              });
          });
        });

        describe('Relation load', () => {
          it('eager loads relations on a populated model', async () => {
            const post = await Post.query().find(1);
            expect(post.author).toBeUndefined();
            expect(post.tags).toBeUndefined();

            await post.load(['author', 'tags']);
            expect(post.author).toBeInstanceOf(User);
            expect(post.tags).toBeInstanceOf(Collection);
            expect(post.author.id).toBe(1);
            expect(post.tags.count()).toBe(3);
          });
  
          it('eager loads attributes on a collection', async () => {
            const posts = await Post.query().get();
            posts.map(post => {
              expect(post.author).toBeUndefined();
              expect(post.tags).toBeUndefined();
            });

            await posts.load(['author', 'tags']);
            posts.map(post => {
              expect(post.author).not.toBeUndefined();
              expect(post.tags).not.toBeUndefined();
            });
          });
        });
      });

      describe('Hooks', () => {
        beforeAll(async () => {
          await connection.schema.table('posts', (table) => {
            table.timestamp('deleted_at').nullable();
          })
        });

        beforeEach(async () => {
          hits = {
            creating: 0,
            created: 0,
            updating: 0,
            updated: 0,
            saving: 0,
            saved: 0,
            deleting: 0,
            deleted: 0,
            trashed: 0,
            forceDeleted: 0,
          }
        });

        class HookPost extends compose(Base, SoftDeletes) {
          table = 'posts';
          static boot() {
            super.boot();
            this.creating(() => {
              hits.creating++;
            });
            this.created(() => {
              hits.created++;
            });
            this.updating(() => {
              hits.updating++;
            });
            this.updated(() => {
              hits.updated++;
            });
          }
        }

        HookPost.saving(() => {
          hits.saving++;
        });
        HookPost.saved(() => {
          hits.saved++;
        });
        HookPost.deleting(() => {
          hits.deleting++;
        });
        HookPost.deleted(() => {
          hits.deleted++;
        });
        HookPost.trashed(() => {
          hits.trashed++;
        });
        HookPost.forceDeleted(() => {
          hits.forceDeleted++;
        });

        it('hit creating, created, saving, saved hooks if use save() create post', async () => {
          const post = new HookPost;
          post.user_id = 0;
          post.name = 'Test create hook';
          await post.save();

          expect(hits).toEqual({
            creating: 1,
            created: 1,
            updating: 0,
            updated: 0,
            saving: 1,
            saved: 1,
            deleting: 0,
            deleted: 0,
            trashed: 0,
            forceDeleted: 0,
          });
        });
        

        it('hit creating, created, saving, saved hooks if use create() create post', async () => {
          await HookPost.query().create({
            user_id: 0,
            name: 'A hook post',
          });

          expect(hits).toEqual({
            creating: 1,
            created: 1,
            updating: 0,
            updated: 0,
            saving: 1,
            saved: 1,
            deleting: 0,
            deleted: 0,
            trashed: 0,
            forceDeleted: 0,
          });
        });

        it('hit updating, updated, saving, saved hooks if use save() update post', async () => {
          const post = await HookPost.query().find(2);
          post.name = 'Test update hook',
          await post.save();

          expect(hits).toEqual({
            creating: 0,
            created: 0,
            updating: 1,
            updated: 1,
            saving: 1,
            saved: 1,
            deleting: 0,
            deleted: 0,
            trashed: 0,
            forceDeleted: 0,
          });
        });

        it('hit deleting, deleted, trashed hooks if soft delete a post', async () => {
          const post = await HookPost.query().find(2);
          await post.delete();

          expect(hits).toEqual({
            creating: 0,
            created: 0,
            updating: 0,
            updated: 0,
            saving: 0,
            saved: 0,
            deleting: 1,
            deleted: 1,
            trashed: 1,
            forceDeleted: 0,
          });
        });

        it('hit deleting, deleted hooks if force delete a post', async () => {
          const post = await HookPost.query().find(1);
          await post.forceDelete();

          expect(hits).toEqual({
            creating: 0,
            created: 0,
            updating: 0,
            updated: 0,
            saving: 0,
            saved: 0,
            deleting: 1,
            deleted: 1,
            trashed: 0,
            forceDeleted: 1,
          });
        });
      });
      
      describe('Paginator', () => {
        
      });
    });
  })
})


