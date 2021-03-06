const WebSocket = require('ws');
const avatar = require('./avatar.js');
const utils = require('./utils.js');

let _websocket;
let _clearCacheInterval;
let _config;

function init(config) {
    _config = config;

    let active = false;
    if(_config.enabled) connectLoop();

    function connectLoop()
    {
        if(!active) {
            if(typeof _websocket !== 'undefined') _websocket.close();
            _websocket = new WebSocket(`${_config.host}:${_config.port}`);
            _websocket.onopen = function(evt) { onOpen(evt) };
            _websocket.onclose = function(evt) { onClose(evt) };
            _websocket.onerror = function(evt) { onError(evt) };
        }
        setTimeout(connectLoop, 5000);
    }

    function onOpen(evt)
    {
        active = true;
        console.log("Started clearCacheInterval");
        _clearCacheInterval = setInterval(avatar.clearCache, 60 * 60 * 1000);
    }

    function onClose(evt)
    {
        active = false;
        console.log("Stopped clearCacheInterval");
        clearInterval(_clearCacheInterval);
        avatar.clearCache();
    }

    function onError(evt) {
        console.log("ERROR: "+JSON.stringify(evt, null, 2));
    }
}

function push(message) {
    if(!_config.enabled) return;

    switch (message.event) {
        case 'PRIVMSG':
            pushMessage(message);
            break;
        case 'FOLLOW':
            pushFollow(message);
            break;
        case 'SUBSCRIPTION_GIFT':
            pushGiftSub(message);
            break;
        case 'RESUBSCRIPTION':
            pushReSub(message);
            break;
        default:
            break;
    }
}

function pushMessage(message) {
    var skip = false;
    if (_config.muteBroadcaster && message.tags.badges.hasOwnProperty('broadcaster')) skip = true;
    _config.ignoreUsers.forEach(function (user) { if (message.tags.username.toLowerCase() == user.toLowerCase()) skip = true; });
    _config.ignorePrefixes.forEach(function (prefix) { if (message.message.indexOf(prefix) == 0) skip = true; });
    if (skip) {
        console.log(`Skipped message from: ${message.tags.displayName}`);
    } else {
        avatar.generate(message.tags.displayName, message.tags.color, message.username).then(data => {
            utils.loadImage(message.profileImageUrl, `${message.tags.userId}.png`, "avatar", data).then(img => {
                _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${utils.getTagValue(message, 'displayName')}: ${message.message}`, image: img}));
            });
        }).catch(() => {
            _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${utils.getTagValue(message, 'displayName')}: ${message.message}` }));
        });

        //_websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${message.tags.displayName}: ${message.message}`, image: avatar}));
        // avatar.generate(message.tags.displayName, message.tags.color, message.username).then((data) => {
        //     _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${message.tags.displayName}: ${message.message}`, image: data }));
        // }).catch(() => {
        //     _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${message.tags.displayName}: ${message.message}` }));
        // });
    }
}

function pushFollow(follow) {
    _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${follow.displayName} followed!` }));
}

function pushGiftSub(giftSub) {
    var skip = false;
    if (_config.muteBroadcaster && giftSub.tags.badges.hasOwnProperty('broadcaster')) skip = true;
    if (skip) {
        console.log(`Skipped message from: ${giftSub.tags.displayName}`);
    } else {
        avatar.generate(giftSub.tags.displayName, giftSub.tags.color, giftSub.username).then(data => {
            utils.loadImage(giftSub.profileImageUrl, `${giftSub.tags.userId}.png`, "avatar", data).then(img => {
                _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${utils.getTagValue(giftSub, 'systemMsg')}`, image: img}));
            });
        }).catch(() => {
            _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${utils.getTagValue(giftSub, 'systemMsg')}` }));
        });
    }
}

function pushReSub(reSub) {
    var skip = false;
    if (_config.muteBroadcaster && reSub.tags.badges.hasOwnProperty('broadcaster')) skip = true;
    if (skip) {
        console.log(`Skipped message from: ${utils.getTagValue(reSub, 'displayName')}`);
    } else {
        avatar.generate(utils.getTagValue(reSub, 'displayName'), utils.getTagValue(reSub, 'color'), reSub.username).then(data => {
            utils.loadImage(reSub.profileImageUrl, `${utils.getTagValue(reSub, 'userId')}.png`, "avatar", data).then(img => {
                _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${utils.getTagValue(reSub, 'systemMsg')}`, image: img}));
            });
        }).catch(() => {
            _websocket.send(JSON.stringify({ title: "Twitch-Logger", message: `${utils.getTagValue(reSub, 'systemMsg')}` }));
        });
    }
}

module.exports = { init, push };
