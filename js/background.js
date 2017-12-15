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

    Proxy.prototype.setProxy = function (proxyAddress, proxyUsername, proxyPassword) {
        if (proxyAddress === undefined || proxyAddress.trim() === "") {
            chrome.proxy.settings.set({value: config(), scope: 'regular'});
        } else {
            chrome.proxy.settings.set(
                {value: config(proxyAddress), scope: 'regular'},
                function () {
                    if (proxyAddress !== "" && proxyUsername !== "") {
                        if (chrome.webRequest.onAuthRequired) {
                            chrome.webRequest.onAuthRequired.addListener(function (details) {
                                return authCredentials(proxyUsername.trim(), proxyPassword.trim());
                            }, {urls: ['<all_urls>']}, ['blocking']);
                        } else {
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

    ProxyByURL.prototype = Object.create(Proxy.prototype);

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

    var removeBlpUrlParams = function (keys, sourceURL) {
        var rtn = sourceURL.split("?")[0],
            param,
            params_arr = [],
            queryString = (sourceURL.indexOf("?") !== -1) ? sourceURL.split("?")[1] : "";
        if (queryString !== "") {
            params_arr = queryString.split("&");
            for (var i = params_arr.length - 1; i >= 0; i -= 1) {
                param = params_arr[i].split("=")[0];
                for (var key = keys.length - 1; key >= 0; key -= 1) {
                    if (param === keys[key]) {
                        params_arr.splice(i, 1);
                    }
                }
            }
            if (params_arr.length !== 0) {
                rtn = rtn + "?" + params_arr.join("&");
            }
        }
        return rtn;
    };

    /**
     * "blpProxyAddress", "blpProxyUsername", "blpProxyPassword" - to pass proxy parameters
     */
    this.run = function () {
        var tabId = undefined;
        var finalUrl = undefined;
        var blpProxyParams = ["blpProxyAddress", "blpProxyUsername", "blpProxyPassword"];

        chrome.webRequest.onBeforeRequest.addListener(function (details) {
            chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
                if (tabs.length > 0 && tabs[0].hasOwnProperty("url")) {
                    var url = tabs[0].url;
                    console.log("Loading URL: " + url)
                    var urlParams = parseQueryString(url);
                    if (urlParams.blpProxyAddress !== undefined) {
                        // console.log("Navigation: " + JSON.stringify(details));
                        // console.log("params: " + JSON.stringify(urlParams));
                        ProxyByURL.prototype.setProxy(urlParams.blpProxyAddress, urlParams.blpProxyUsername, urlParams.blpProxyPassword);
                        finalUrl = removeBlpUrlParams(blpProxyParams, url);
                    }
                }
            });
            if (finalUrl !== undefined) {
                return {redirectUrl: finalUrl};
            }
        }, {urls: ['<all_urls>'], types: ['main_frame']}, ['blocking']);

        chrome.tabs.onUpdated.addListener(function (tabId, info) {
            if (info.status === "complete") {
                ProxyByURL.prototype.setProxy();
                console.log("Completed loading URL: " + finalUrl);
            }
        });
    };
};

new Proxy().run();
new ProxyByURL().run();