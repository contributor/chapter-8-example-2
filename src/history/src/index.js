const express = require("express");
const bodyParser = require("body-parser");
const mongodb = require("mongodb");
const amqp = require("amqplib");

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
async function connectDb() {
    const client = await mongodb.MongoClient.connect(DBHOST);
    return client.db(DBNAME);
}

//
// Connect to the RabbitMQ server.
//
async function connectRabbit() {

    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);
    const connection = await amqp.connect(RABBIT); // Connect to the RabbitMQ server
    console.log("Connected to RabbitMQ.");

    return connection.createChannel(); // Create a RabbitMQ messaging channel.
}

//
// Setup event handlers.
//
async function setupHandlers(app, db, messageChannel) {

    const videosCollection = db.collection("videos");

    app.get("/history", (req, res) => {
        const skip = parseInt(req.query.skip);
        const limit = parseInt(req.query.limit);
        videosCollection.find()
            .skip(skip)
            .limit(limit)
            .toArray()
            .then(documents => {
                res.json({ history: documents });
            })
            .catch(err => {
                console.error(`Error retrieving history from database.`);
                console.error(err && err.stack || err);
                res.sendStatus(500);
            });
    });

    async function consumeViewedMessage(msg) { // Handler for coming messages.
        console.log("Received a 'viewed' message");

        const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message
        console.log(JSON.stringify(parsedMsg, null, 4)); // JUST PRINTING THE RECEIVED MESSAGE.

        await videosCollection.insertOne({ videoPath: parsedMsg.videoPath }); // Record the "view" in the database.
        console.log("Inserted record into db");

        messageChannel.ack(msg); // If there is no error, acknowledge the message.
        console.log("Acknowledged message was handled.");
    };

    await messageChannel.assertExchange("viewed", "fanout") // Assert that we have a "viewed" exchange.
    console.log("Asserted that the 'viewed' exchange exists.");

    const response = await messageChannel.assertQueue("", { exclusive: true }); // Create an anonyous queue.
    const queueName = response.queue;
    console.log(`Created queue ${queueName}, binding it to "viewed" exchange.`);

    await messageChannel.bindQueue(queueName, "viewed", "") // Bind the queue to the exchange.
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

async function main() {
    const db = await connectDb();
    const messageChannel = await connectRabbit();
    return startHttpServer(db, messageChannel);
}

main()
    .then(() => console.log("Microservice online."))
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });    
