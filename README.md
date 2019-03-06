# serverless-positive-chat

An inclusive chat that avoids negative messages and translates the content in the language that you choose.

Ths application is designed to be completely serverless, using:

- [Amazon API Gateway](https://aws.amazon.com/api-gateway/) to manage WebSocket communication between the browser and the Lambda function
- [AWS Lambda](https://aws.amazon.com/lambda/) for the custom business logic
- [Amazon Comprehend](https://aws.amazon.com/comprehend/) to detect the dominant language and sentiment of the messages
- [Amazon Translate](https://aws.amazon.com/translate/) to translate the messages in the language chosen by each participant of a chat room
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) to store messages and connection information

![serverless-positive-chat architecture](https://danilop.s3.amazonaws.com/Images/positive-chat-architecture.png)

You can find a brief description of the architecture here:

https://speakerdeck.com/danilop/serverless-real-time-apps-lets-build-a-positive-chat

A sample deployment is available at:

https://pchat.demo.danilop.net

Pick a username, a chat room, and the language you want to use to receive your messages.

```bash
.
├── README.md                   <-- This instructions file
├── positive-chat               <-- Source code for the lambda function
│   ├── app.js                  <-- Lambda function code
│   └── package.json            <-- NodeJS dependencies
├── www                         <-- Source code for the web content
│   ├── index.html              <-- HTML page
│   └── index.js                <-- JavaScript running in the browser
├── deploy.sh                   <-- Deployment script
└── template.yaml               <-- SAM template
```

## Requirements

* [AWS CLI](https://aws.amazon.com/cli/) already configured with Administrator permission
* [AWS SAM CLI](https://aws.amazon.com/serverless/sam/) to manage serverless deployments

## Setup process

Create two S3 buckets, one for the deployment packages and one for hosting the website. Bucket names must be unique, so those in the folowing sample are probably taken:

```bash
$ aws s3 mb positive-chat-packages # choose a unique bucket name here
$ aws s3 mb positive-chat-web      # ...
```

Update the `deploy.sh` script to use the two buckets you created and run it:

```
BUCKET_PACKAGES=positive-chat-packages # use the buckets you create before
BUCKET_WWW=positive-chat-web           # ...
```

```bash
./deploy.sh
```

The `deploy.sh` script gets the WebSocket (WSS) URI from the output of the [CloudFormation](https://aws.amazon.com/cloudformation/) stack to pass it to the web app, so that you don't need to configure it manually.

Using a web browser, go to the S3 bucket you are using for the website, for example:

http://positive-chat-web.s3.amazonaws.com/index.html

Then pick a username, a chat room, and the language you want to use to recevie your messages.

Add a CloudFront distribution to have HTTPS access with the domain of your choice. WebSockets are always encrypted (WSS) by the API Gateway.

