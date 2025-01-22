const { Model, Collection, compose, Attribute, make, makeCollection, makePaginator, Paginator } = require('../src/browser');

Promise.delay = function (duration) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, duration)
  });
}

describe('browser environment test', () => {
  test('should load the browser version of the module', () => {
    // Test automatically loads the browser version
    const module = require('sutando');
    expect(module.isBrowser).toBe(true);
  });

  test('should load the node version of the module', () => {
    // Test that it is the browser version of the module
    const module = require('sutando/browser');
    expect(module.isBrowser).toBe(true);
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
    relationPosts() {
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

  it('return the table name of the plural model name', () => {
    const user = new User;
    expect(user.getTable()).toBe('users');
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

  describe('#make', () => {
    it('should return a Model instance', () => {
      const user = make(User, {
        id: 1
      });
      expect(user).toBeInstanceOf(User);

      const anotherUser = make(User, {
        id: 1,
        posts: [
          {
            id: 1,
            title: 'Test'
          },
          {
            id: 2,
            title: 'Test 2'
          }
        ]
      });
      expect(anotherUser).toBeInstanceOf(User);
      expect(anotherUser.posts).toBeInstanceOf(Collection);
      expect(anotherUser.posts.count()).toBe(2);
      expect(anotherUser.posts.get(1).title).toBe('Test 2');
    });

    it('should return a Collection instance', () => {
      const data = [
        {
          id: 1,
          name: 'Test'
        },
        {
          id: 2,
          name: 'Test 2'
        }
      ];
      const users = make(User, data);
      expect(users).toBeInstanceOf(Collection);
      expect(users.count()).toBe(2);
      expect(users.get(1).name).toBe('Test 2');

      const users2 = makeCollection(User, data);
      expect(users2).toBeInstanceOf(Collection);
      expect(users2.count()).toBe(2);
      expect(users2.get(1).name).toBe('Test 2');
    });

    it('should return a Paginator instance', () => {
      const data = {
        total: 2,
        data: [
          {
            id: 1,
            name: 'Test'
          },
          {
            id: 2,
            name: 'Test 2'
          }
        ],
        current_page: 1,
        per_page: 10,
      };

      const users = make(User, data, {
        paginated: true
      });
      expect(users).toBeInstanceOf(Paginator);
      expect(users.total()).toBe(2);
      expect(users.perPage()).toBe(10);
      expect(users.currentPage()).toBe(1);
      expect(users.items().count()).toBe(2);
      expect(users.items().get(1)).toBeInstanceOf(User);

      const users2 = makePaginator(User, data, {
        paginated: true
      });
      expect(users2).toBeInstanceOf(Paginator);
      expect(users2.total()).toBe(2);
      expect(users2.perPage()).toBe(10);
      expect(users2.currentPage()).toBe(1);
      expect(users2.items().count()).toBe(2);
      expect(users2.items().get(1)).toBeInstanceOf(User);
    });

    it('should return a Model instance', () => {
      const user = User.make({
        id: 1
      });
      expect(user).toBeInstanceOf(User);

      const anotherUser = User.make({
        id: 1,
        posts: [
          {
            id: 1,
            title: 'Test'
          },
          {
            id: 2,
            title: 'Test 2'
          }
        ]
      });
      expect(anotherUser).toBeInstanceOf(User);
      expect(anotherUser.posts).toBeInstanceOf(Collection);
      expect(anotherUser.posts.count()).toBe(2);
      expect(anotherUser.posts.get(1).title).toBe('Test 2');
    });
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

      get another_full_name() {
        return `${this.attributes.firstName} ${this.attributes.lastName}`;
      }

      set another_full_name(value) {
        const names = value.split(' ');
        this.attributes.firstName = names[0];
        this.attributes.lastName = names[1];
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

      it('append virtual attribute', () => {
        const data = testModel.append(['another_full_name', 'full_name']).toData();
        expect(data).toEqual({
          address: '123 Main St.',
          firstName: 'Joe',
          another_full_name: 'Joe Shmoe',
          full_name: 'Joe Shmoe',
          id: 1,
          lastName: 'Shmoe'
        });

        testModel.another_full_name = 'Bill Gates';
        expect(testModel.toData()).toEqual({
          address: '123 Main St.',
          firstName: 'Bill',
          another_full_name: 'Bill Gates',
          full_name: 'Bill Gates',
          id: 1,
          lastName: 'Gates'
        });

        expect(testModel.isDirty('firstName')).toBeTruthy();
        expect(testModel.isDirty('lastName')).toBeTruthy();
        expect(testModel.isDirty()).toBeTruthy();
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

describe('Integration test', () => {
  describe('Client: ', () => {

    class Base extends Model {
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

    class Post extends Base {
      scopeIdOf(query, id) {
        return query.where('id', id);
      }

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

    describe('Model', () => {
      describe('#isDirty()', () => {
        it('returns true if passing an attribute name that has changed since the last sync', () => {
          const user = new User;
          user.name = 'changed name';
          expect(user.isDirty('name')).toBe(true);
        });
  
        it('returns false if passing an attribute name that has not changed since the last sync', () => {
          const user = new User;
          user.name = 'changed name';
          expect(user.isDirty('id')).toBe(false);
        });
  
        it('returns true if no arguments are provided and an attribute of the model has changed', () => {
          const user = new User;
          user.name = 'changed name';
          expect(user.isDirty()).toBe(true);
        });
  
        it("returns false if no arguments are provided and the model hasn't changed", () => {
          const user = new User;
          expect(user.isDirty()).toBe(false);
        });
      });
    });
  });
})


