const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const comprehend = new AWS.Comprehend();
const translate = new AWS.Translate();

const SUPPORTED_LANGUAGES = [ 'de', 'pt', 'en', 'it', 'fr', 'es' ];

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE;

const translations = {};

exports.lambdaHandler = async (event, context) => {
    console.log(event);

    const eventType = event.requestContext.eventType;
    const connectionId = event.requestContext.connectionId;

    const domainName = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    const agma = new AWS.ApiGatewayManagementApi({
        endpoint: domainName + '/' + stage
    });

    switch(eventType) {
        case 'CONNECT':
            break;
        case 'DISCONNECT':
            await deleteConnection(connectionId);
            break;
        case 'MESSAGE':
            await processMessage(agma, connectionId, event.body);
            break;
        default:
            console.log('Error: unknown event type ' + eventType);
    }

    const response = {
        statusCode: 200
    };

    return response;
};

async function processMessage(agma, connectionId, body) {
    console.log('processMessage', connectionId, body);

    const message = JSON.parse(body);
    message.timestamp = Date.now();
    const action = message.action;
    delete message.action;

    switch(action) {
        case 'message':
            await analyzeMessage(message);
            if (message.reject) {
                await rejectMessage(agma, connectionId, message);
            } else {
                await sendMessageToRoom(agma, connectionId, message);
            }
            break;
        case 'init':
            await initConnection(connectionId, message.room, message.lang);
            await sendRoomMessages(agma, connectionId, message.room, message.lang);
            break;
        default:
            console.log('Error: unknown action ' + action);
    }

}

async function initConnection(connectionId, room, lang) {
    console.log('initConnection', connectionId, room, lang);
    const params = {
        TableName: CONNECTIONS_TABLE,
        Item: {
            connectionId: connectionId,
            lang: lang,
            room: room
        }
    };
    await docClient.put(params).promise();
}

async function sendMessageToRoom(agma, sourceConnectionId, message) {
    console.log('sendMessageToRoom', sourceConnectionId, message);

    // get room from connectionId

    const connectionData = await docClient.get({
        TableName: CONNECTIONS_TABLE,
        Key: {
            connectionId: sourceConnectionId
        }
    }).promise();

    if (!('room' in connectionData.Item)) {
        return;
    }

    message.room = connectionData.Item.room;

    await storeMessage(message);

    // get all connections from room
    const connectionsData = await docClient.query({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'roomIndex',
        KeyConditionExpression: 'room = :room',
        ExpressionAttributeValues: {
            ':room': message.room
        }
    }).promise();

    await Promise.all(
        connectionsData.Items.map(async ({ connectionId, lang }) => {
            await translateMessage(message, lang);
            await sendMessagesToConnection(agma, connectionId, [ message ]);
        })
    );
}

async function translateMessage(message, destLang) {
    console.log('translateMessage', message, destLang);
    if (destLang !== message.lang) {
        message.destLang = destLang;
        if (translations[message.content] && translations[message.content][destLang]) {
           message.translated = translations[message.content][destLang];
        } else {
            const translateData = await translate.translateText({
                SourceLanguageCode: message.lang,
                TargetLanguageCode: destLang,
                Text: message.content
            }).promise();
            message.translated = translateData.TranslatedText;
            if (!translations[message.content]) {
                translations[message.content] = {};
            }
            translations[message.content][destLang] = message.translated;
        }
    }
}

async function sendMessagesToConnection(agma, connectionId, messages) {
    console.log('sendMessagesToConnection', connectionId, messages);
    try {
        await agma.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(messages)
        }).promise();
    } catch (err) {
        if (err.statusCode === 410) {
            await deleteConnection(connectionId);
        } else {
            throw err;
        }
    }
}

async function rejectMessage(agma, connectionId, message) {
    console.log('rejectyMessage', connectionId, message);
    message.user = 'Positive Chat';
    const destLang = message.lang;
    message.lang = 'en';
    message.content = message.reject;
    await translateMessage(message, destLang);
    await sendMessagesToConnection(agma, connectionId, [ message ]);
}

async function analyzeMessage(message) {
    console.log('checkMessage', message);
    const languageData = await comprehend.detectDominantLanguage({
        Text: message.content
    }).promise();
    console.log(languageData);
    message.lang = languageData.Languages.reduce(
        (acc, val) => {
            if (val.Score > acc.Score) { return val; } else { return acc; }
        }, { Score: 0}).LanguageCode;
    if (SUPPORTED_LANGUAGES.indexOf(message.lang) === -1) {
        response.reject = 'Sorry, language "' + message.lang + '" is not supported.'
    } else {
        const sentimentData = await comprehend.detectSentiment({
            LanguageCode: message.lang,
            Text: message.content
        }).promise();
        console.log(sentimentData);
        message.sentiment = sentimentData;
        if (message.sentiment.Sentiment === 'NEGATIVE') {
            message.reject = 'Please find a better way to express this.'
        }
        const entitiesData = await comprehend.detectEntities({
            LanguageCode: message.lang,
            Text: message.content
        }).promise();
        console.log(entitiesData);
        message.topics = entitiesData.Entities.reduce(
            (acc, val) => {
                console.log(acc, val);
                const topic = val.Text;
                console.log(topic);
                if (acc[topic]) {
                    acc[topic]++;
                } else {
                    acc[topic] = 1;
                }
                return acc;
            }, {});
    }
    console.log(message);
}

async function deleteConnection(connectionId) {
    console.log('deleteConnection', connectionId);
    const params = {
        TableName: CONNECTIONS_TABLE,
        Key: {
            connectionId: connectionId
        }
    };
    await docClient.delete(params).promise();
}

async function storeMessage(message) {
    console.log('storeMessage', message);
    const params = {    
        TableName: CONVERSATIONS_TABLE,
        Item: message
    };
    await docClient.put(params).promise();
}

async function sendRoomMessages(agma, connectionId, room, destLang) {
    console.log('sendRoomMessages', connectionId, room, destLang);
    const conversationsData = await docClient.query({
        TableName: CONVERSATIONS_TABLE,
        KeyConditionExpression: 'room = :room',
        ExpressionAttributeValues: {
            ':room': room
        }
    }).promise();
    const messages = [];
    for (const message of conversationsData.Items) {
        await translateMessage(message, destLang);
        messages.push(message);
    }
    await sendMessagesToConnection(agma, connectionId, messages);
}

