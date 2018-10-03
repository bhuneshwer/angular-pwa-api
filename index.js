// Reading process.env variables from .env file
require('dotenv').config()

// Scaffolding Express app
var express = require('express')
var app = express()
var server = require('http').createServer(app)

var bodyParser = require('body-parser')
app.use(bodyParser.json())

// Enabling CORS
var cors = require('cors')
app.use(cors())
app.options('*', cors())

app.get('/assets/redirect/redirectfrom.html', (req, res) => {
    console.log('redirectfrom')
    res.redirect(301, '/assets/redirect/redirectto.html')
})

// Static assets
app.use(express.static(__dirname))

// Setting up detailed logging
var winston = require('winston')
var logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            json: true,
            level: 'info' // Set 'debug' for super-detailed output
        })
    ],
    exitOnError: false
})
logger.stream = {
    write: function(message, encoding) {
        logger.info(message)
    }
}
app.use(require('morgan')('combined', {
    'stream': logger.stream
}))

// Reading command line arguments
var argv = require('yargs')
    .usage('Usage: $0 --stringToMonitor [string]')
    .argv

var stringToMonitor = argv.stringToMonitor || 'javascript'

var offlineTimeline = require('./offline-data/timeline.json')

// Setting Web Push credentials
var webPush = require('web-push');

webPush.setVapidDetails(
    'mailto:bhunesh11@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
)
console.warn("process.env.VAPID_PUBLIC_KEY", process.env.VAPID_PUBLIC_KEY)
var pushSubscriptions = [{
    "endpoint": "https://fcm.googleapis.com/fcm/send/d0o8DAWDye0:APA91bGMJlK7BudH6K5fTbrPW5Pbmnv2GQAkXMP7IEec90xXaHI0kwjDj_v5Mgm_Tz-MJKOqRNEVykuRZFeJxxPCr_ABFJoMhJbaJamwOw8smhBs_XvTmSWAh3MUzbF9slyGg3GR00XS",
    "expirationTime": null,
    "keys": {
        "p256dh": "BEkd_TCQ0LqBSw5fAtoU2sf4OajIl9Z1xTk_Ftqt1KzR3Pf5GZjaBmdjHAoqF88o05BRUdjdz7QXGhbPPzIuWEU",
        "auth": "mh85INT3URx8WkZUT_wFdA"
    }
}]

// // Connecting to Twitter
// // Get your credentials here: https://apps.twitter.com/app/new
// var Twitter = require('twitter')
// var twitterClient = new Twitter({
//   consumer_key: process.env.TWITTER_CONSUMER_KEY,
//   consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
//   access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
//   access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
// })

// Subscribe to Web Push
app.post('/webpush', function(req, res, next) {
    logger.info('Web push subscription object received: ', req.body.subscription)

    if (req.body.action === 'subscribe') {
        if (arrayObjectIndexOf(pushSubscriptions, req.body.subscription.endpoint, 'endpoint') == -1) {
            pushSubscriptions.push(req.body.subscription)
            logger.info('Subscription registered: ' + req.body.subscription.endpoint)
        } else {
            logger.info('Subscription was already registered: ' + req.body.subscription.endpoint)
        }

        res.send({
            text: 'Web push subscribed',
            status: '200'
        })
    } else if (req.body.action === 'unsubscribe') {
        var subscriptionIndex = arrayObjectIndexOf(pushSubscriptions, req.body.subscription.endpoint, 'endpoint')

        if (subscriptionIndex >= 0) {
            pushSubscriptions.splice(subscriptionIndex, 1)

            logger.info('Subscription unregistered: ' + req.body.subscription.endpoint)
        } else {
            logger.info('Subscription was not found: ' + req.body.subscription.endpoint)
        }

        res.send({
            text: 'Web push unsubscribed',
            status: '200'
        })
    } else {
        throw new Error('Unsupported action')
    }

    logger.info('Number of active subscriptions: ' + pushSubscriptions.length)
})

let timerValue = 1;

// setInterval(function() {
//     notify();

// }, 5000);

notify();

function notify() {
    timerValue += 1;
    let tweet = {
        "text": "Hello there......" + timerValue,
        "lang": "en",
        "id": "txtwPl" + timerValue,
        "favorite_count": timerValue,
        "retweet_count": timerValue + timerValue,
        "created_at": new Date(),
        "id_str": "txtwPlStr" + timerValue,
        "user": {
            "name": "Bhunesh" + timerValue,
            "profile_image_url_https": "https://4.bp.blogspot.com/-nt2yf3Qwlzk/WtgKCiuMUkI/AAAAAAAAF9w/fLER1Z3dHdII5DPmwdaGGHW46UOBpaHBQCEwYBhgL/s1600/cool%2Bprofile%2Bpictures.png",
        },
        "entities": {
            "media": [{ "media_url_https": "http://profilepicturesdp.com/wp-content/uploads/2018/07/pictures-for-a-profile-pic.jpg" }]
        }
    }

    if (tweet && tweet.user) {
        var notificationData = {}
        notificationData.notification = {
            title: tweet.user.name,
            actions: [{
                action: 'opentweet',
                title: 'Open tweet'
            }],
            body: tweet.text,
            dir: 'auto',
            icon: tweet.user.profile_image_url_https,
            badge: tweet.user.profile_image_url_https,
            lang: tweet.lang,
            renotify: true,
            requireInteraction: true,
            tag: tweet.id,
            vibrate: [300, 100, 400],
            data: {
                url: 'https://twitter.com/statuses/' + tweet.id_str,
                created_at: tweet.created_at,
                favorite_count: tweet.favorite_count,
                retweet_count: tweet.retweet_count
            }
        }

        if (tweet.entities && tweet.entities.media) {
            notificationData.notification.image = tweet.entities.media[0].media_url_https
        }

        logger.debug(notificationData)
        logger.debug(tweet)
        logger.info('Tweet stream received')
        pushSubscriptions.forEach(function(item) {
            sendNotification(item, JSON.stringify(notificationData))
        });
    }
}

function sendNotification(pushSubscription, payload) {
    console.log("pushSubscription", pushSubscription)
    console.log("payload", payload)
    if (pushSubscription) {
        webPush.sendNotification(pushSubscription, payload)
            .then(function(response) {
                logger.info('Push sent')
                logger.debug(payload)
                logger.debug(response)
            })
            .catch(function(error) {
                logger.error('Push error: ', error)
            })
    }
}

// Go to https://dev.twitter.com/rest/tools/console to get endpoints list

// Exposing the timeline endpoint
app.get('/search/:query', function(req, res, next) {
    res.send([{
        "text": "Hello there......",
        "lang": "en",
        "id": "txtwPl",
        "favorite_count": 100,
        "retweet_count": 120,
        "created_at": new Date(),
        "id_str": "txtwPlStr",
        "user": {
            "name": "Bhunesh",
            "profile_image_url_https": "https://4.bp.blogspot.com/-nt2yf3Qwlzk/WtgKCiuMUkI/AAAAAAAAF9w/fLER1Z3dHdII5DPmwdaGGHW46UOBpaHBQCEwYBhgL/s1600/cool%2Bprofile%2Bpictures.png",
        },
        "entities": {
            "media": [{ "media_url_https": "http://profilepicturesdp.com/wp-content/uploads/2018/07/pictures-for-a-profile-pic.jpg" }]
        }
    }])
})

// Exposing the timeline endpoint
app.get('/timeline/offline', function(req, res, next) {
    res.send(offlineTimeline)
})

// Exposing the timeline endpoint
app.get('/timeline/:screenName?', function(req, res, next) {
    res.send([{
        "text": "Hello there......Search...",
        "lang": "en",
        "id": "txtwPl",
        "favorite_count": 100,
        "retweet_count": 120,
        "created_at": new Date(),
        "id_str": "txtwPlStr",
        "user": {
            "name": "Bhunesh",
            "profile_image_url_https": "https://4.bp.blogspot.com/-nt2yf3Qwlzk/WtgKCiuMUkI/AAAAAAAAF9w/fLER1Z3dHdII5DPmwdaGGHW46UOBpaHBQCEwYBhgL/s1600/cool%2Bprofile%2Bpictures.png",
        },
        "entities": {
            "media": [{ "media_url_https": "http://profilepicturesdp.com/wp-content/uploads/2018/07/pictures-for-a-profile-pic.jpg" }]
        }
    }])
})

// Exposing the favorites endpoint
app.get('/favorites/:screenName?', function(req, res, next) {
    res.send([{
        "text": "Hello there......Search...Favs",
        "lang": "en",
        "id": "txtwPl",
        "favorite_count": 100,
        "retweet_count": 120,
        "created_at": new Date(),
        "id_str": "txtwPlStr",
        "user": {
            "name": "Bhunesh",
            "profile_image_url_https": "https://4.bp.blogspot.com/-nt2yf3Qwlzk/WtgKCiuMUkI/AAAAAAAAF9w/fLER1Z3dHdII5DPmwdaGGHW46UOBpaHBQCEwYBhgL/s1600/cool%2Bprofile%2Bpictures.png",
        },
        "entities": {
            "media": [{ "media_url_https": "http://profilepicturesdp.com/wp-content/uploads/2018/07/pictures-for-a-profile-pic.jpg" }]
        }
    }])
})

// Placeholder to test Background Sync
app.post('/post-tweet', function(req, res, next) {
    if (req.body.message) {
        logger.info('The data was received from front-end', req.body.message)
        res.send({
            text: req.body.message,
            status: '200'
        })
    } else {
        throw new Error('Message text is required')
    }
})

// Posting the tweet
app.post('/real-post-tweet', function(req, res, next) {
    if (req.body.message) {
        logger.info('The data was received from front-end', req.body.message)
        res.send(req.body.message)
    } else {
        throw new Error('Message text is required')
    }
})



// Default endpoint
app.get('/', function(req, res, next) {
    res.send('PWA Workshop API works! Source: <a href="https://github.com/webmaxru/pwa-workshop-api">https://github.com/webmaxru/pwa-workshop-api</a>')
})

// Starting Express

server.listen(process.env.PORT || 3000, function() {
    logger.info('Listening on port ' + (process.env.PORT || 3000))
})

// Utility function to search the item in the array of objects
function arrayObjectIndexOf(myArray, searchTerm, property) {
    for (var i = 0, len = myArray.length; i < len; i++) {
        if (myArray[i][property] === searchTerm) return i
    }
    return -1
}