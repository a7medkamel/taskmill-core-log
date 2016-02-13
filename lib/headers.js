"use strict";

var _ = require('lodash');

class Headers { 
  constructor(headers) {
    this.headers = _.mapKeys(headers, (value, key) => key.toLowerCase());

    this.raw = headers;
  }

  get(key) {
    return this.headers[(key || '').toLowerCase()];
  }

  has(key) {
    return _.has(this.headers, (key || '').toLowerCase());
  }

  toObject() {
    return this.raw;
  }
}

module.exports = Headers;