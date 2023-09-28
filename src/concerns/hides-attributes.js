const _ = require('lodash');

const HidesAttributes = (Model) => {
  return class extends Model {
    hidden = [];
    visible = [];

    makeVisible(...keys) {
      const visible = _.flatMapDeep(keys);
      this.visible = [...this.visible, ...visible];
  
      this.hidden = _.difference(this.hidden, visible);
      return this;
    }

    makeHidden(...keys) {
      const hidden = _.flatMapDeep(keys);
      this.hidden = [...this.hidden, ...hidden];
  
      this.visible = _.difference(this.visible, hidden);
      return this;
    }
  }
};

module.exports = HidesAttributes;