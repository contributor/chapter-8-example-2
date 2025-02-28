const express = require("express");
const mongodb = require("mongodb");
const amqp = require('amqplib');
const bodyParser = require("body-parser");

if (!process.env.DBHOST) {
    throw new Error("Please specify the databse host using environment variable DBHOST.");
}

if (!process.env.DBNAME) {
    throw new Error("Please specify the name of the database using environment variable DBNAME");
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const DBHOST = process.env.DBHOST;
const DBNAME = process.env.DBNAME;
const RABBIT = process.env.RABBIT;

//
// Connect to the database.
//
function connectDb() {
    return mongodb.MongoClient.connect(DBHOST)
        .then(client => {
            return client.db(DBNAME);
        });
}

//
// Connect to the RabbitMQ server.
//
function connectRabbit() {

    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);

    return amqp.connect(RABBIT) // Connect to the RabbitMQ server.
        .then(messagingConnection => {
            console.log("Connected to RabbitMQ.");

            return messagingConnection.createChannel(); // Create a RabbitMQ messaging channel.
        });
}

//
// Setup event handlers.
//
async function setupHandlers(app, db, messageChannel) {

    const historyCollection = db.collection("videos");

    // ... YOU CAN PUT HTTP ROUTES AND OTHER MESSAGE HANDLERS HERE ...

    async function consumeViewedMessage(msg) { // Handler for coming messages.
        console.log("Received a 'viewed' message:");

        const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message.
        console.log(JSON.stringify(parsedMsg, null, 4)); // JUST PRINTING THE RECEIVED MESSAGE.

        await historyCollection.insertOne({ videoPath: parsedMsg.videoPath }); // Record the "view" in the database.
        console.log("Inserted record into db");

        messageChannel.ack(msg); // If there is no error, acknowledge the message.
        console.log("Acknowledged message was handled.");
    };

    await messageChannel.assertExchange("viewed", "fanout"); // Assert that we have a "viewed" exchange.

    const response = await messageChannel.assertQueue("", { exclusive: true }); // Create an anonyous queue.
    const queueName = response.queue;
    console.log(`Created queue ${queueName}, binding it to "viewed" exchange.`);

    await messageChannel.bindQueue(queueName, "viewed", ""); // Bind the queue to the exchange.
    await messageChannel.consume(queueName, consumeViewedMessage); // Start receiving messages from the anonymous queue.
}

//
// Start the HTTP server.
//
function startHttpServer(db, messageChannel) {
    return new Promise(resolve => { // Wrap in a promise so we can be notified when the server has started.
        const app = express();
        app.use(bodyParser.json()); // Enable JSON body for HTTP requests.
        setupHandlers(app, db, messageChannel);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3000;
        app.listen(port, () => {
            resolve(); // HTTP server is listening, resolve the promise.
        });
    });
}

//
// Application entry point.
//
function main() {
    return connectDb()                                          // Connect to the database...
        .then(db => {                                           // then...
            return connectRabbit()                              // connect to RabbitMQ...
                .then(messageChannel => {                       // then...
                    return startHttpServer(db, messageChannel); // start the HTTP server.
                });
        });
}

main()
    .then(() => console.log("Microservice online."))
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });