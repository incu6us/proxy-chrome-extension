var Proxy = function () {

    var storedData = {};

    var config = function (proxyAddress) {
        if (proxyAddress === undefined || proxyAddress === "") {
            return {
                mode: "direct"
            };
        }
        return {
            mode: "fixed_servers",
            rules: {
                proxyForHttp: {
                    host: proxyAddress.split(":")[0],
                    port: parseInt(proxyAddress.split(":")[1])
                },
                proxyForHttps: {
                    host: proxyAddress.split(":")[0],
                    port: parseInt(proxyAddress.split(":")[1])
                },
                bypassList: ["localhost,127.0.0.1"]
            }
        }
    };

    var credentialsToHeader = function (details, proxyUsername, proxyPassword) {
        if ((proxyUsername === undefined && proxyPassword === undefined) || (proxyUsername === "" && proxyPassword === "")) {
            return {requestHeaders: details.requestHeaders};
        }

        for (var header in details.requestHeaders) {
            if (header.name == 'Authorization') {
                return {};
            }
        }

        details.requestHeaders.push({
            name: 'Authorization',
            value: 'Basic ' + btoa(proxyUsername + ':' + proxyPassword)
        });

        return {requestHeaders: details.requestHeaders};
    };

    var authCredentials = function (proxyUsername, proxyPassword) {
        return {
            authCredentials: {
                username: proxyUsername,
                password: proxyPassword
            }
        }
    };

    Proxy.prototype.setProxy = function(proxyAddress, proxyUsername, proxyPassword) {
        // if (Object.keys(storedData).length === 0 || storedData.proxyAddress.trim() === "") {
        console.log("1");
        if (proxyAddress === undefined || proxyAddress.trim() === "") {
            chrome.proxy.settings.set({value: config(proxyAddress), scope: 'regular'});
        } else {
            chrome.proxy.settings.set(
                {value: config(proxyAddress), scope: 'regular'},
                function () {
                    if (proxyAddress !== "" || proxyUsername !== "") {
                        if (chrome.webRequest.onAuthRequired) {
                            chrome.webRequest.onAuthRequired.addListener(function (details) {
                                return authCredentials(proxyUsername.trim(), proxyPassword.trim());
                            }, {urls: ['<all_urls>']}, ['blocking']);
                        } else {
                            // chrome.webRequest.onBeforeSendHeaders.removeListener(credentialsToHeader)
                            chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
                                return credentialsToHeader(details, proxyUsername.trim(), proxyPassword.trim());
                            }, {urls: ['<all_urls>']}, ['blocking', 'requestHeaders']);
                        }
                    }
                }
            );
        }
        debugProxySettings();
    };

    var debugProxySettings = function () {
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
    };

    var init = function () {
        if (Object.keys(storedData).length !== 0) {
            Proxy.prototype.setProxy(storedData.proxyAddress, storedData.proxyUsername, storedData.proxyPassword);
        }
        chrome.storage.onChanged.addListener(function (changes, namespace) {
            // for (k in changes)
            chrome.storage.sync.get(
                null,
                function (items) {
                    storedData = items
                    Proxy.prototype.setProxy(storedData.proxyAddress, storedData.proxyUsername, storedData.proxyPassword);
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

var ProxyByURL = function () {

    var parseQueryString = function (url) {
        var urlParams = {};
        url.replace(
            new RegExp("([^?=&]+)(=([^&]*))?", "g"),
            function ($0, $1, $2, $3) {
                urlParams[$1] = $3;
            }
        );

        return urlParams;
    };

    this.run = function () {
        chrome.webNavigation.onBeforeNavigate.addListener(function (details) {
            if (details.frameId === 0) {
                console.log("Navigation: " + JSON.stringify(details));
                var urlParams = parseQueryString(details.url);
                console.log("params: " + JSON.stringify(urlParams));
            }
        });
    };
};

var proxy = new Proxy();
proxy.run();

new ProxyByURL().run();