'use strict';

const Homey = require('homey');

module.exports = class NextDnsApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('NextDNS has been initialized');
  }

};
