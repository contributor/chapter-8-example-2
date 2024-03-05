const express = require("express");
const fs = require("fs");
const path = require("path");
const amqp = require('amqplib');

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const RABBIT = process.env.RABBIT;

//
// Connect to the RabbitMQ server.
//
async function connectRabbit() {

    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);
    const connection = await amqp.connect(RABBIT); // Connect to the RabbitMQ server
    console.log("Connected to RabbitMQ.");

    const messageChannel = await connection.createChannel(); // Create a RabbitMQ messaging channel.
    messageChannel.assertExchange("viewed", "fanout");
    return messageChannel;
}

//
// Send the "viewed" to the history microservice.
//
function sendViewedMessage(messageChannel, videoPath) {
    console.log(`Publishing message on "viewed" exchange.`);

    const msg = { videoPath: videoPath };
    const jsonMsg = JSON.stringify(msg);
    messageChannel.publish("viewed", "", Buffer.from(jsonMsg)); // Publish message to the "viewed" exchange.
}

//
// Setup event handlers.
//
function setupHandlers(app, messageChannel) {
    app.get("/video", (req, res) => {
        console.log("serving video");
        const videoPath = path.join("./videos", "SampleVideo_1280x720_1mb.mp4");
        fs.stat(videoPath, (err, stats) => {
            if (err) {
                console.error("Can't access video file", err);
                res.sendStatus(500);
                return;
            }

            res.writeHead(200, {
                "Content-Length": stats.size,
                "Content-Type": "video/mp4",
            });
    
            fs.createReadStream(videoPath).pipe(res);

            sendViewedMessage(messageChannel, videoPath); // Send message to "history" microservice that this video has been "viewed".
        });
    });
}

function startHttpServer(messageChannel) {
    return new Promise((resolve, reject) => { // Wrap in a promise so we can be notified when the server has started.
        const app = express();
        setupHandlers(app, messageChannel);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3000;
        app.listen(port, () => {
            resolve();
        });
    });
}

async function main() {
    const messageChannel = await connectRabbit();                         // Connect to RabbitMQ...
    return startHttpServer(messageChannel); // start the HTTP server.
}

main()
    .then(() => console.log("Microservice online."))
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });