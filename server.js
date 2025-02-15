require('dotenv').config(); // load env variables
const express = require('express'); // creates express app
const cors = require('cors');  // used to enable API to be accessed from different domains 
const { v4: uuidv4 } = require('uuid'); // allows us create unique IDs 
const redis = require('redis');

//creates express app
const app = express();
const PORT = process.env.PORT || 3000;

//Middleware
// allows request from different origins
app.use(cors());
app.use(express.json());


// redis client 
// handles redis client 
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
})

redisClient.connect().then(() => console.log("Connected to Redis")).catch(err => console.error("Redis connection error:", err));

//Basic route API route
app.get('/', (req, res) => {
    res.send({ message: "Darknet comms API is running" });
});

//start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// (1) create a route to generate chatroom ID , (2) store the chatroom in redis with an expiration time , (3) return chatroom ID to client 
app.post('/create-room', async (req, res) => {

    try {
        const chatroomId = uuidv4(); // get unique chatroom id 
        const ttl = 1200; //Chatroom expires in 20 minutes(1200 seconds)
        //big hitter, waiting for our room to timeout
        await redisClient.setEx(`chatroom:${chatroomId}`, ttl, "active");
        // tl:dr : redisclient.setEx sets key with expiration time , 
        res.json({ chatroomId, message: "Chatroom created successfully", expiresIn: ttl });
        // tl:dr: sends request back to client 
    } catch (error) {
        console.error("Error creating chatroom: ", error);
        res.status(500).json({ error: "Failed to create chatroom" });
    }
});

// endpoint to send a message to a chatroom. The endpoint expects a JSON body. 
app.post('/send-message', async (req, res) => {
    try {
        const { chatroomId, message } = req.body;
        // validate input ensuring we have a chatroom running 
        if (!chatroomId || !message) {
            return res.status(400).json({ error: 'chatroomId and message are required' }); // returns bad request when missing
        }
        // check if the chatroom exists
        const chatroomKey = `chatroom:${chatroomId}`;
        const chatroomStatus = await redisClient.get(chatroomKey);
        if (!chatroomStatus) {
            return res.status(404).json({ error: 'Chatroom not found or expired' });
        }

        // creates a unique message ID and key for storing message 
        const messageId = uuidv4();
        const messageKey = `chatroom:${chatroomId}:message:${messageId}`;

        //Define TTL for the message 
        const messageTTL = 300;

        //construct the message object and convert it to string for storage
        //created a JSON formatted string from a javascript object
        const messageData = JSON.stringify(
            {
                messageId,
                text: message,
                timestamp: Date.now()
            });

        //store the message with a TTL to it auto-deletes after messageTTL seconds
        await redisClient.setEx(messageKey, messageTTL, messageData);

        //Add message key to a list associated with the chatroom
        // rpush pushes message into redis list linked with chatroom 
        await redisClient.rPush(`chatroom:${chatroomId}:messages`, messageKey);

        res.json(
            {
                message: "Message sent successfully",
                messageId,
                expiresIn: messageTTL
            });

    } catch (error) {
        console.error("Error sending message: ", error);
        res.status(500).json({ error: "Failed to send message" });
    }
});

//endpoint to read message and delete from storage
app.get('/messages/:chatroomId', async (req, res) => {
    try {
        const { chatroomId } = req.params;
        const chatroomKey = `chatroom:${chatroomId}`;

        // 1.) first check if chatroom exists
        const chatroomStatus = await redisClient.get(chatroomKey);
        if (!chatroomStatus) {
            return res.status(404).json({ error: 'Chatroom not found or expired' });
        }

        //2.) retrieve list of message keys associated with this chatroom
        const messageListKey = `chatroom:${chatroomId}:messages`;
        const messageKeys = await redisClient.lRange(messageListKey, 0, -1);

        if (!messageKeys || messageKeys.length === 0) {
            return res.json({ messages: [] });
        }

        //3.) Fetch all messages concurrently 
        const messagesData = await Promise.all(
            messageKeys.map(key => redisClient.get(key))
        );

        // parse each message (which was stored as a JSON string)
        const messages = messagesData.map(data => JSON.parse(data));

        //4. Delete all message keys and the associated list from Redis
        // so they self-destruct immediately after being read 
        //delete chatroom jey 


        await redisClient.del(...messageKeys);
        await redisClient.del(messageListKey);
        await redisClient.del(chatroomKey);


        // 5. Return the fetched messages to the client 
        res.json({ messages });

    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});


