function difference(setA, setB) {
  let _difference = new Set(setA);
  for (let elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}

async function addToCallCenter(userId, groupId, add) {
  const url = `https://dialpad.com/api/operator/${userId}?group_id=${groupId}`;
  const body = add ? '{"add":true,"skill_level":100}' : '{"remove":true}';

  const response = await fetch(url, {
    headers: { ...popup.headers, "request-timestamp": Date.now() },
    referrer: "https://dialpad.com/accounts",
    referrerPolicy: "no-referrer-when-downgrade",
    body,
    method: "PATCH",
    mode: "cors",
    credentials: "include",
  });

  document.getElementById(groupId);
}

async function assignToAllCallCenters(userId) {
  const groupIds = ["agxzfnViZXItdm9pY2VyFwsSCkNhbGxDZW50ZXIYgIC09PSyywgM"];

  const promises = groupIds.map((groupId) =>
    addToCallCenter(userId, groupId, true)
  );

  return await Promise.all(promises);
}

Vue.component("spinner", {
  props: ["size"],
  template: `
    <div class="spinner" v-bind:style="{ width: (size * 3.89) + 'px' }">
      <div class="bounce1" v-bind:style="{ width: size + 'px', height: size + 'px' }"></div>
      <div class="bounce2" v-bind:style="{ width: size + 'px', height: size + 'px' }"></div>
      <div class="bounce3" v-bind:style="{ width: size + 'px', height: size + 'px' }"></div>
    </div>
  `,
});

const app = new Vue({
  el: "#app",
  data: {
    userData: {
      id: null,
      call_center_ids: [],
      display_name: null,
      primary_email: null,
    },
    headers: [],
    callCenters: [],
    checkedCallCenterIds: [],
    isThinking: false,
  },
  methods: {
    assign: async function () {
      this.isThinking = true;

      // await assignToAllCallCenters(this.userId);

      // this.isThinking = false;
    },
    isMember: function (callCenter) {
      return this.userData.call_center_ids.includes(callCenter.id);
    },
    checkAll: function() {
      this.checkedCallCenterIds = [...this.callCenters.map(cc => cc.id)];
    },
    checkNone: function() {
      this.checkedCallCenterIds = [];
    },
    checkReset: function() {
      this.checkedCallCenterIds = [...this.userData.call_center_ids];
    },
  },
  computed: {
    have: function () {
      return new Set(this.userData.call_center_ids);
    },
    want: function () {
      return new Set(this.checkedCallCenterIds);
    },
    toAdd: function () {
      return difference(this.want, this.have);
    },
    toRemove: function () {
      return difference(this.have, this.want);
    },
  },
  watch: {
    checkedCallCenterIds: function (checkedCallCenterIds) {
      console.log("Observed checkedCallCenterIds change", checkedCallCenterIds);
      chrome.storage.sync.set({ checkedCallCenterIds });
    },
  },
});

async function xhr(url, method = "GET", body = null) {
  const response = await fetch(url, {
    headers: { ...app.headers, "request-timestamp": Date.now() },
    referrer: "https://dialpad.com/accounts",
    referrerPolicy: "no-referrer-when-downgrade",
    body,
    method,
    mode: "cors",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed XHR ${method} to ${url} (${response.status})`);
  }

  return await response.json();
}

async function init() {
  // load up the most recent way we had the check boxes checked
  chrome.storage.sync.get(["checkedCallCenterIds"], (value) => {
    console.log("Stored value (sync): ", value);
    const { checkedCallCenterIds } = value;

    app.checkedCallCenterIds = checkedCallCenterIds ?? [];
  });

  // load up stuff pertaining to this user
  chrome.storage.local.get(["userData", "headers"], async (value) => {
    console.log("Stored value (local): ", value);
    const { userData, headers } = value;

    app.headers = headers;
    app.userData = userData;
    app.callCenters = (await xhr("https://dialpad.com/api/group")).sort(
      function (a, b) {
        if (a.display_name < b.display_name) {
          return -1;
        }
        if (a.display_name > b.display_name) {
          return 1;
        }
        return 0;
      }
    );
  });
}

init();
