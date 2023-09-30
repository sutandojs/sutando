const flattenDeep = require('lodash/flattenDeep');
const difference = require('lodash/difference');

const HidesAttributes = (Model) => {
  return class extends Model {
    hidden = [];
    visible = [];

    makeVisible(...keys) {
      const visible = flattenDeep(keys);
      this.visible = [...this.visible, ...visible];

      this.hidden = difference(this.hidden, visible);
      return this;
    }

    makeHidden(...keys) {
      const hidden = flattenDeep(keys);
      this.hidden = [...this.hidden, ...hidden];

      this.visible = difference(this.visible, hidden);
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
    }

    setVisible(visible) {
      this.visible = visible;
    }
  }
}

module.exports = HidesAttributes;