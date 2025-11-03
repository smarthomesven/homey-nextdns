'use strict';

const Homey = require('homey');
const axios = require('axios');

module.exports = class ProfileDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Profile driver has been initialized');
  }

  async onRepair(session, device) {
    session.setHandler("apikey", async (data) => {
      this.homey.settings.set('apikey',data.apikey);
      await session.done();
    });
  }

  async onPair(session) {
    session.setHandler("showView", async (viewId) => {
      if (viewId === 'apikey') {
        try {
          const key = this.homey.settings.get('apikey');
          if (key) {
            await session.showView('list_devices');
          }
        } catch (error) {
          throw new Error("Error while checking API key in storage: " + error.message);
        }
      }
    });
    session.setHandler("apikey", async (data) => {
      try {
        const response = await axios.get('https://api.nextdns.io/profiles', {
          headers: {
            'X-Api-Key': `${data.apikey}`
          }
        });
        const apidata = response.data;
        if (apidata.errors && apidata.errors[0].code === "authRequired") {
          return false;
        };
        this.homey.settings.set('apikey',data.apikey);
        await session.showView('list_devices');
        return true;
      } catch (error) {
        throw new Error("Error during API key check: " + error.message);
      }
    });
    session.setHandler("list_devices", async () => {
      try {
      const key = this.homey.settings.get('apikey');
      if (!key) {
        throw new Error("API key not found in storage.");
      }
      const profiles = await axios.get('https://api.nextdns.io/profiles', {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      const profiledata = profiles.data;
      if (profiledata.errors && profiledata.errors[0].code === "authRequired") {
        throw new Error("Invalid API key.");
      };
      const result = profiledata.data.map(profile => ({
        name: profile.name,
        data: { id: profile.id },
        store: { id: profile.id }
      }));
      return result;
    } catch (error) {
      throw new Error("Error while fetching profiles: " + error.message);
    }
    });
  }

  async checkStatus(device) {
    try {
      const key = this.homey.settings.get("apikey");
      const profile = device.getStoreValue("id");
      let time;
      const settings = device.getSettings();
      const option = settings.timerange || '24h';
      if (option === 'all') {
        time = '';
      } else {
        time = `?from=-${option}`;
      }
      const response = await axios.get(`https://api.nextdns.io/profiles/${profile}/analytics/status${time}`, {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      const statsdata = response.data;
      if (statsdata.errors && statsdata.errors[0].code === "authRequired") {
          throw new Error("Invalid API key.");
      };
      device.setAvailable();
      const blocked = response.data.data.find(item => item.status === "blocked")?.queries || 0;
      const allowed = response.data.data.find(item => item.status === "default")?.queries || 0;
      const total = blocked + allowed;
      device.setCapabilityValue("total_dns_requests", total);
      device.setCapabilityValue("blocked_dns_requests", blocked);
      device.setCapabilityValue("allowed_dns_requests", allowed);
    } catch (error) {
      this.error("Error while checking device status: " + error.message);
      device.setUnavailable().catch(this.error);
    }
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    try {
      const key = this.homey.settings.get('apikey');
      if (!key) {
        throw new Error("API key not found in storage.");
      }
      const profiles = await axios.get('https://api.nextdns.io/profiles', {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      const profiledata = profiles.data;
      if (profiledata.errors && profiledata.errors[0].code === "authRequired") {
        throw new Error("Invalid API key.");
      };
      const result = profiledata.data.map(profile => ({
        name: profile.name,
        data: { id: profile.id },
        store: { id: profile.id }
      }));
      return result;
    } catch (error) {
      throw new Error("Error while fetching profiles: " + error.message);
    }
  }

};
