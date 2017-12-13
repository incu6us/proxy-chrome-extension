var Proxy = function () {

    var storedData = {};

    var config = function () {
        if (Object.keys(storedData).length === 0 || storedData.proxyAddress == "") {
            console.log("data: " + JSON.stringify(storedData))
            return {
                mode: "direct"
            };
        }
        return {
            mode: "fixed_servers",
            rules: {
                proxyForHttp: {
                    host: storedData.proxyAddress.split(":")[0],
                    port: parseInt(storedData.proxyAddress.split(":")[1])
                },
                proxyForHttps: {
                    host: storedData.proxyAddress.split(":")[0],
                    port: parseInt(storedData.proxyAddress.split(":")[1])
                },
                bypassList: ["localhost,127.0.0.1"]
            }
        }
    };

    var credentialsToHeader = function (status) {
        for (var header in status.requestHeaders) {
            if (header.name == 'Authorization') {
                return {};
            }
        }

        status.requestHeaders.push({
            name: 'Authorization',
            value: 'Basic ' + btoa(storedData.proxyUsername + ':' + storedData.proxyPassword)
        });

        return {requestHeaders: status.requestHeaders};
    };

    var authCredentials = function (status) {
        return {
            authCredentials: {
                username: storedData.proxyUsername,
                password: storedData.proxyPassword
            }
        }
    }

    var setProxy = function () {
        if (Object.keys(storedData).length === 0 || storedData.proxyAddress.trim() === "") {
            chrome.proxy.settings.set({value: config(), scope: 'regular'});
        } else {
            chrome.proxy.settings.set(
                {value: config(), scope: 'regular'},
                function () {
                    if (storedData.proxyAddress != "" || storedData.proxyUsername != "") {
                        if (chrome.webRequest.onAuthRequired) {
                            chrome.webRequest.onAuthRequired.addListener(authCredentials, {urls: ['<all_urls>']}, ['blocking']);
                        } else {
                            // chrome.webRequest.onBeforeSendHeaders.removeListener(credentialsToHeader)
                            chrome.webRequest.onBeforeSendHeaders.addListener(credentialsToHeader, {urls: ['<all_urls>']}, ['blocking', 'requestHeaders']);
                        }
                    }
                }
            );
        }
        debug();
    };

    var debug = function () {
        chrome.proxy.settings.get(
            {'incognito': false},
            function (config) {
                console.log("Proxy settings: " + JSON.stringify(config));
                console.log("Auth settings: " + JSON.stringify(
                    {
                        username: storedData.proxyUsername,
                        password: storedData.proxyPassword
                    }
                ));
            }
        );
    }

    var init = function () {
        if (Object.keys(storedData).length != 0) {
            setProxy();
        }
        chrome.storage.onChanged.addListener(function (changes, namespace) {
            // for (k in changes)
            chrome.storage.sync.get(
                null,
                function (items) {
                    storedData = items
                    setProxy();
                }
            );
        });
    };

    this.run = function () {
        chrome.storage.sync.get(
            null,
            function (items) {
                storedData = items
                init();
            }
        );
    };
};

new Proxy().run();

