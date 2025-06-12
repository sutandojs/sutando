const flattenDeep = require('lodash/flattenDeep');
const difference = require('lodash/difference');

const HidesAttributes = (Model) => {
  return class extends Model {
    hidden = [];
    visible = [];

    makeVisible(...keys) {
      const visible = flattenDeep(keys);

      if (this.visible.length > 0) {
        this.visible = [...this.visible, ...visible];
      }

      this.hidden = difference(this.hidden, visible);
      return this;
    }

    makeHidden(...keys) {
      const hidden = flattenDeep(keys);

      if (this.hidden.length > 0) {
        this.hidden = [...this.hidden, ...hidden];
      }
      return this;
    }

    getHidden() {
      return this.hidden;
    }

    getVisible() {
      return this.visible;
    }

    setHidden(hidden) {
      this.hidden = hidden;
      return this;
    }

    setVisible(visible) {
      this.visible = visible;
      return this;
    }
  }
}

module.exports = HidesAttributes;