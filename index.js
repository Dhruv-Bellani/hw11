
// You MUST have a file called "token.secret" in the same directory as this file!
// This should be the secret token found in https://dashboard.ngrok.com/
// Make sure it is on a single line with no spaces!
// It will NOT be committed.

// TO START
//   1. Open a terminal and run 'npm start'
//   2. Open another terminal and run 'npm run tunnel'
//   3. Copy/paste the ngrok HTTPS url into the DialogFlow fulfillment.
//
// Your changes to this file will be hot-reloaded!

import fetch from 'node-fetch';
import fs from 'fs';
import ngrok from 'ngrok';
import morgan from 'morgan';
import express from 'express';
import CS571 from '@cs571/mobile-client';
import { text } from 'stream/consumers';

// Read and register with secret ngrok token.
ngrok.authtoken(fs.readFileSync("token.secret").toString().trim());

// Start express on port 53705
const app = express();
const port = 53705;

// Accept JSON bodies and begin logging.
app.use(express.json());
app.use(morgan(':date ":method :url" :status - :response-time ms'));

// "Hello World" endpoint.
// You should be able to visit this in your browser
// at localhost:53705 or via the ngrok URL.
app.get('/', (req, res) => {
  res.status(200).send(JSON.stringify({
    msg: 'Express Server Works!'
  }))
})

// Dialogflow will POST a JSON body to /.
// We use an intent map to map the incoming intent to
// its appropriate async functions below.
// You can examine the request body via `req.body`
// See https://cloud.google.com/dialogflow/es/docs/fulfillment-webhook#webhook_request
app.post('/', (req, res) => {
  const intent = req.body.queryResult.intent.displayName;

  // A map of intent names to callback functions.
  // The "HelloWorld" is an example only -- you may delete it.
  const intentMap = {
    // "HelloWorld": doHelloWorld,
    "GetChatroomMessages": getPosts, 
    "GetWhenPosted": getRecentPost,
  }

  if (intent in intentMap) {
    // Call the appropriate callback function
    intentMap[intent](req, res);
  } else {
    // Uh oh! We don't know what to do with this intent.
    // There is likely something wrong with your code.
    // Double-check your names.
    console.error(`Could not find ${intent} in intent map!`)
    res.status(404).send(JSON.stringify({ msg: "Not found!" }));
  }
})

// Open for business!
app.listen(port, () => {
  console.log(`DialogFlow Handler listening on port ${port}. Use 'npm run tunnel' to expose this.`)
})

// Your turn!
// Each of the async functions below maps to an intent from DialogFlow
// Complete the intent by fetching data from the API and
// returning an appropriate response to DialogFlow.
// See https://cloud.google.com/dialogflow/es/docs/fulfillment-webhook#webhook_response
// Use `res` to send your response; don't return!

async function doHelloWorld(req, res) {
  res.status(200).send({
    fulfillmentMessages: [
      {
        text: {
          text: [
            'You will see this if you trigger an intent named HelloWorld'
          ]
        }
      }
    ]
  })
}

async function getRecentPost(req, res) {
  const chatroomName = req.body.queryResult.parameters.chatroom;
  try {
    const response = await fetch(`https://cs571.org/api/f23/hw11/messages?chatroom=${chatroomName}&page=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CS571-ID': 'bid_063cb5f8b3e8cbed55f1a0853fcdf8260757bd1caa625ae82d5fb792edd6517e',
      }
    });
    const data = await response.json();
    const getLatestMessage = data.messages[0];
    const date = new Date(getLatestMessage.created);
    const givenDate = date.toLocaleDateString();
    const givenTime = date.toLocaleTimeString();

    // Send response to DialogFlow
    res.status(200).send({
      fulfillmentMessages: [{
        text: {
          text: [
            `The last message in ${chatroomName} was posted on ${givenDate} at ${givenTime}!`
          ]
        }
      }]
    });
  } catch (error) {
    console.error('Error fetching recent post date:', error);
    // Send an error response to DialogFlow
    res.status(500).send({
      fulfillmentMessages: [{
        text: {
          text: [
            `There was an error retrieving the latest message in ${chatroomName}.`
          ]
        }
      }]
    });
  }
}

async function getPosts(req, res) {
  const chatroomName = req.body.queryResult.parameters.chatroom;
  const returnedResquestedPosts = req.body.queryResult.parameters.numMessages;
  const GivenNumberOfPosts = returnedResquestedPosts > 5 ? 5 : returnedResquestedPosts || 1

  try{
    const response = await fetch(`https://cs571.org/api/f23/hw11/messages?chatroom=${chatroomName}&page=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CS571-ID': 'bid_063cb5f8b3e8cbed55f1a0853fcdf8260757bd1caa625ae82d5fb792edd6517e'
      }
    });

    const data = await response.json();
    const posts = data.messages.slice(0, GivenNumberOfPosts)

    let textResponse;
    if(returnedResquestedPosts === 1) {
      textResponse = {
        text: {
          text: [`Here is the latest message from ${chatroomName}!`]
        }
      };
    } else if (returnedResquestedPosts > 5) {
      textResponse = {
        text: {
          text: [`Sorry, you can only get upto the latest 5 messages. Here are the 5 latest messages from ${chatroomName}`]
        }
      };
    } else {
      textResponse = {
        text: {
          text: [`Here are the latest ${GivenNumberOfPosts} messages from ${chatroomName}!`]
        }
      };
    }

    const cardResponses = posts.map(post => ({
      card: {
        title: post.title,
        subtitle: `Posted by: ${post.poster}`,
        buttons: [
          {
            text: "Read more",
            postback: `https://cs571.org/f23/badgerchat/chatrooms/${encodeURIComponent(chatroomName)}`
          }
        ]
      }
    }));

    res.status(200).send({
      fulfillmentMessages: [textResponse, ...cardResponses]
    });

  }catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).send({
      fulfillmentMessages: [{
        text: {
          text: [`There was an error retreiving posts from ${chatroomName}.`]
        }
      }]
    })
  }
}
