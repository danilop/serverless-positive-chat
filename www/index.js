const SUPPORTED_LANGUAGES = {
    ar: 'Arabic',
    zh: 'Chinese (Simplified)',
    cs: 'Czech',
    da: 'Danish',
    nl: 'Dutch',
    en: 'English',
    fi: 'Finnish',
    fr: 'French',
    de: 'German',
    he: 'Hebrew',
    hi: 'Hindi',
    id: 'Indonesian',
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    ms: 'Malay',
    no: 'Norwegian',
    fa: 'Persian',
    pl: 'Polish',
    pt: 'Portuguese',
    ru: 'Russian',
    es: 'Spanish',
    sv: 'Swedish',
    tr: 'Turkish'
};

const DEFAULT_LANGUAGE = 'en';

const roomInfo = document.getElementById('room-info');
const chat = document.getElementById('chat');
const controls = document.getElementById('controls');

const urlParams = new URLSearchParams(window.location.search);
let room = urlParams.get('room');
let user = urlParams.get('user');
let lang = urlParams.get('lang');

let connection;

function setup_choose_language() {
    const langSection = document.getElementById('lang-section');

    const langSelect = document.createElement('select');
    langSelect.id = 'lang-select';
    for (let l in SUPPORTED_LANGUAGES) {
        const option = document.createElement('option');
        option.value = l;
        option.text = SUPPORTED_LANGUAGES[l];
        if (l === lang || (lang === null && l === DEFAULT_LANGUAGE)) {
            option.selected = 'selected';
        }
        langSelect.appendChild(option);
    }
    var p = document.createElement("p");
    p.appendChild(document.createTextNode('Translate all messages to: '));
    p.appendChild(langSelect);
    p.appendChild(document.createTextNode(' You can always write messages in any of the supported languages.'));
    langSection.appendChild(p);
}

function get_config() {
    controls.innerHTML = `
        <form id="start-form">
            <p>User: <input type='user' id='user'/></p>
            <p>Room: <input type='room' id='room'/></p>
            <div id='lang-section'></div>
            <button type='submit' id='start-button'>Start</button></p>
        </form>
    `;

    setup_choose_language();

    const roomText = document.getElementById('room');
    const userText = document.getElementById('user');

    if (user !== null) {
        userText.value = user;
    }

    if (room !== null) {
        roomText.value = room;
    }

    document.getElementById('start-form').addEventListener('submit', (evt) => {
        evt.preventDefault();
        const langSelect = document.getElementById('lang-select');
        const langSelected = langSelect.options[langSelect.selectedIndex].value;
        let href = '/?';
        if (userText.value) {
            href += 'user=' + userText.value + '&';
        }
        if (roomText.value) {
            href += 'room=' + roomText.value + '&';
        }
        href += 'lang=' + langSelected;
        window.location.href = href;
    });
}

function start_chat(wss_uri) {

    controls.innerHTML = `
        <div id='lang-section'></div>
        <form id="send-form">
            <input type="text" id="send-text"/>
            <button type="submit">Send</button>
        </form>
    `;

    setup_choose_language();

    document.getElementById('lang-section').addEventListener('change', () => {
        const langSelect = document.getElementById('lang-select');
        const langSelected = langSelect.options[langSelect.selectedIndex].value;
        window.location.href = '/?user=' + user + '&room=' + room + '&lang=' + langSelected;
    });

    connection = new WebSocket(wss_uri);

    connection.onopen = () => {
        console.log('WebSocket open');
        updateRoomInfo();
        chat.innerHTML = '';
        sendMessage({ action: 'init', lang: lang, room: room });
    };

    connection.onerror = (error) => {
        console.log('WebSocket error', error);
    };

    connection.onmessage = (message) => {
        console.log('WebSocket message', message.data);
        const messages = JSON.parse(message.data);
        for (let m of messages) {
            console.log(m);
            let date = new Date(m.timestamp).toLocaleString().toLowerCase();
            let html = '<p>' + '<strong>' + removeTags(m.user) + '</strong> <em>' + date + '</em>';
            if (Object.keys(m.topics).length > 0) {
                html += ' [' + Object.keys(m.topics).join(', ') + ']';
            }
            html += '<br>[' + m.lang + '] ' + removeTags(m.content);
            if ('translated' in m) {
                html += '<br>' + '[' + m.destLang + '] ' + m.translated;
            }
            html += '</p>';
            chat.innerHTML += html;
            if (m.roomTopics) {
                updateRoomInfo(m.roomTopics);
            }
        }
        // scroll to the bottom
        const scrollingElement = (document.scrollingElement || document.body);
        scrollingElement.scrollTop = scrollingElement.scrollHeight;
    };

    connection.onclose = (evt) => {
        console.log('WebSocket close');
        if (evt.code != 1000 && navigator.onLine) {
            init();
        }
    };

    document.getElementById('send-form').addEventListener('submit', (evt) => {
        evt.preventDefault();
        const sendText = document.getElementById('send-text');
        const content = sendText.value;
        if (content !== '') {
            sendText.value = '';
            sendMessage({ action: 'message', user: user, content: content });
        }
    });
}

function updateRoomInfo(topicsList) {
    var html = '<h2>' + user + ' [' + lang + '] @ ' + room;
    if (topicsList) {
        html += ' [' + topicsList.join(', ') + ']';
    }
    html += '</h2>';
    roomInfo.innerHTML = html;
}

function sendMessage(message) {
    const rawMessage = JSON.stringify(message);
    console.log('sendMessage: ' + rawMessage);
    connection.send(rawMessage);
}

function removeTags(text) {
    return text.replace(/<[^>]*>/g, '');
}

function init() {
    if (user !== null && room !== null && lang !== null) {
        console.log('fetch');
        fetch('./wss-uri.txt')
            .then(function(response) {
                console.log('fetched');
                return response.text();
            })
            .then(function(wss_uri) {
                console.log('resolved');
                console.log(wss_uri);
                start_chat(wss_uri);
            });
    }
    else {
        get_config();
    }
}

init();
