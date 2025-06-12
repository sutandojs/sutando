const Scope = require('./scope');
const { tap } = require('./utils');

const hasJoins = (statements) => {
  for (const statement of statements) {
    if (statement?.grouping === 'join') {
      return true;
    }
  }

  return false;
}

class SoftDeletingScope extends Scope {
  extensions = ['Restore', 'RestoreOrCreate', 'CreateOrRestore', 'WithTrashed', 'WithoutTrashed', 'OnlyTrashed'];

  apply(builder, model) {
    builder.whereNull(model.getQualifiedDeletedAtColumn());
  }

  extend(builder) {
    for (const extension of this.extensions) {
      this[`add${extension}`](builder);
    }

    builder.onDelete(async (builder) => {
      const column = this.getDeletedAtColumn(builder);

      return await builder.update({
        [column]: builder.getModel().freshTimestampString(),
      });
    });
  }

  getDeletedAtColumn(builder) {
    if (hasJoins(builder.getQuery()._statements)) {
      return builder.getModel().getQualifiedDeletedAtColumn();
    }

    return builder.getModel().getDeletedAtColumn();
  }

  addRestore(builder) {
    builder.macro('restore', (builder) => {
      builder.withTrashed();

      return builder.update({
        [builder.getModel().getDeletedAtColumn()]: null
      });
    });
  }

  addRestoreOrCreate(builder) {
    builder.macro('restoreOrCreate', async (builder, attributes = {}, values = {}) => {
      builder.withTrashed();

      return tap(await builder.firstOrCreate(attributes, values), async (instance) => {
        await instance.restore();
      });
    });
  }

  addCreateOrRestore(builder) {
    builder.macro('createOrRestore', async (builder, attributes = {}, values = {}) => {
      builder.withTrashed();

      return tap(await builder.createOrFirst(attributes, values), async (instance) => {
        await instance.restore();
      });
    });
  }

  addWithTrashed(builder) {
    builder.macro('withTrashed', (builder, withTrashed = true) => {
      if (! withTrashed) {
        return builder.withoutTrashed();
      }

      return builder.withoutGlobalScope(this);
    });
  }

  addWithoutTrashed(builder) {
    builder.macro('withoutTrashed', (builder) => {
      const model = builder.getModel();

      builder.withoutGlobalScope(this).whereNull(
        model.getQualifiedDeletedAtColumn()
      );

      return builder;
    });
  }

  addOnlyTrashed(builder) {
    builder.macro('onlyTrashed', (builder) => {
      const model = builder.getModel();

      builder.withoutGlobalScope(this).whereNotNull(
        model.getQualifiedDeletedAtColumn()
      );

      return builder;
    });
  }
}

module.exports = SoftDeletingScope;