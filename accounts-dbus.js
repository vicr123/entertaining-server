
const dbus = require('dbus-next');

let accountsBus = new dbus.sessionBus({
    busAddress: "unix:path=/var/vicr123-accounts/vicr123-accounts-bus"
});

let accountsManager;

(async() => {
    let accountsPath = await accountsBus.getProxyObject("com.vicr123.accounts", "/com/vicr123/accounts");
    accountsManager = accountsPath.getInterface("com.vicr123.accounts.Manager");
})();

module.exports = {
    bus: accountsBus,
    manager: () => accountsManager,
    path: async (path) => await accountsBus.getProxyObject("com.vicr123.accounts", path),
    variant: (sig, value) => new dbus.Variant(sig, value)
}
