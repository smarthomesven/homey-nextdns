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
      try {
        const response = await axios.get('https://api.nextdns.io/profiles', {
          headers: {
            'X-Api-Key': `${data.apikey}`
          }
        });
        this.homey.settings.set('apikey',data.apikey);
        await session.done();
        return true;
      } catch (error) {
        if (error.response && error.response.status === 403) {
          return false;
        }
        throw new Error("Error during API key check: " + error.message);
      }
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
        this.homey.settings.set('apikey',data.apikey);
        await session.showView('list_devices');
        return true;
      } catch (error) {
        if (error.response && error.response.status === 403) {
          return false;
        }
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
      device.setAvailable();
      const blocked = response.data.data.find(item => item.status === "blocked")?.queries || 0;
      const allowed = response.data.data.find(item => item.status === "default")?.queries || 0;
      const total = blocked + allowed;
      device.setCapabilityValue("total_dns_requests", total);
      device.setCapabilityValue("blocked_dns_requests", blocked);
      device.setCapabilityValue("allowed_dns_requests", allowed);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        device.setUnavailable(this.homey.__("errors.key")).catch(this.error);
        return;
      }
      this.error("Error while checking device status: " + error.message);
      device.setUnavailable(this.homey.__("errors.unreachable")).catch(this.error);
    }
  }

  async addBlocklist(domain, device) {
    try {
      const key = this.homey.settings.get("apikey");
      const profile = device.getStoreValue("id");
      if (!domain) {
        throw new Error("No domain provided for blocklist.");
      }
      if (!key) {
        throw new Error("API key not found in storage.");
      }
      if (!profile) {
        throw new Error("Profile ID not found in device store.");
      }
      const response = await axios.post(`https://api.nextdns.io/profiles/${profile}/denylist`, {
        id: domain,
        active: true
      }, {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      if (response.status === 204) {
        return true;
      }
    } catch (error) {
      if (error.response && error.response.status === 403) {
        throw new Error("Invalid API Key.");
      }
      throw new Error("Error while adding domain to blocklist: " + error.message);
    }
  }

  async removeBlocklist(domain, device) {
    try {
      const key = this.homey.settings.get("apikey");
      const profile = device.getStoreValue("id");
      if (!domain) {
        throw new Error("No domain provided for blocklist.");
      }
      if (!key) {
        throw new Error("API key not found in storage.");
      }
      if (!profile) {
        throw new Error("Profile ID not found in device store.");
      }
      const hex = Buffer.from(domain, "utf8").toString("hex");
      const response = await axios.delete(`https://api.nextdns.io/profiles/${profile}/denylist/hex:${hex}`, {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      if (response.status === 404 || response.status === 204) {
        return true;
      }
    } catch (error) {
      if (error.response && error.response.status === 403) {
        throw new Error("Invalid API Key.");
      }
      throw new Error("Error while adding domain to blocklist: " + error.message);
    }
  }

  async addWhitelist(domain, device) {
    try {
      const key = this.homey.settings.get("apikey");
      const profile = device.getStoreValue("id");
      if (!domain) {
        throw new Error("No domain provided for whitelist.");
      }
      if (!key) {
        throw new Error("API key not found in storage.");
      }
      if (!profile) {
        throw new Error("Profile ID not found in device store.");
      }
      const response = await axios.post(`https://api.nextdns.io/profiles/${profile}/allowlist`, {
        id: domain,
        active: true
      }, {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      if (response.status === 204) {
        return true;
      }
    } catch (error) {
      if (error.response && error.response.status === 403) {
        throw new Error("Invalid API Key.");
      }
      throw new Error("Error while adding domain to whitelist: " + error.message);
    }
  }

  async removeWhitelist(domain, device) {
    try {
      const key = this.homey.settings.get("apikey");
      const profile = device.getStoreValue("id");
      if (!domain) {
        throw new Error("No domain provided for whitelist.");
      }
      if (!key) {
        throw new Error("API key not found in storage.");
      }
      if (!profile) {
        throw new Error("Profile ID not found in device store.");
      }
      const hex = Buffer.from(domain, "utf8").toString("hex");
      const response = await axios.delete(`https://api.nextdns.io/profiles/${profile}/allowlist/hex:${hex}`, {
        headers: {
          'X-Api-Key': `${key}`
        }
      });
      if (response.status === 404 || response.status === 204) {
        return true;
      }
    } catch (error) {
      if (error.response && error.response.status === 403) {
        throw new Error("Invalid API Key.");
      }
      throw new Error("Error while adding domain to whitelist: " + error.message);
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
