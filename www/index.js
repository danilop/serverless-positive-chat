const SUPPORTED_LANGUAGES = {
    de: 'German',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese'
};

const DEFAULT_LANGUAGE = 'en';

const chat = document.getElementById('chat');
const controls = document.getElementById('controls');

const urlParams = new URLSearchParams(window.location.search);
let room = urlParams.get('room');
let user = urlParams.get('user');
let lang = urlParams.get('lang');

let connection;

function get_config() {
    controls.innerHTML = `
        <p>User: </p><input type='user' id='user'/>
        <p>Room: </p><input type='room' id='room'/>
        <p>Language: </p><div id='lang-section'></div>
        <button type='button' id='start-button'>Start</button>
    `;

    const langSection = document.getElementById('lang-section');

    const langSelect = document.createElement('select');
    langSelect.id = 'lang-select';
    langSection.appendChild(langSelect);

    for (let l in SUPPORTED_LANGUAGES) {
        const option = document.createElement('option');
        option.value = l;
        option.text = SUPPORTED_LANGUAGES[l];
        if (l === lang || (lang === null && l === DEFAULT_LANGUAGE)) {
            option.selected = 'selected';
        }
        langSelect.appendChild(option);
    }
    
    const roomText = document.getElementById('room');
    const userText = document.getElementById('user');

    if (user !== null) {
        userText.value = user;
    }

    if (room !== null) {
        roomText.value = room;
    }

    document.getElementById('start-button').addEventListener('click', () => {
        const langSelect = document.getElementById('lang-select');
        const langSelected = langSelect.options[langSelect.selectedIndex].value;
        window.location.href = '/?user=' + userText.value + '&room=' + roomText.value + '&lang=' + langSelected;
    });
}

function start_chat(wss_uri) {
    
    connection = new WebSocket(wss_uri);

    connection.onopen = () => {
        console.log('WebSocket open');
        chat.innerHTML = '';
        sendMessage({ action: 'init', lang: lang, room: room });
        chat.innerHTML += '<h2>' + user + ' @ ' + room + ' [' + lang + ']' + '</h2>';
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
            let html = '<p>' + '<strong>' + m.user + '</strong> <em>' + date + '</em>';
            if (Object.keys(m.topics).length > 0) {
                html += ' [' + Object.keys(m.topics).join(', ') + ']';
            }
            html += '<br>[' + m.lang + '] ' + m.content;
            if ('translated' in m) {
                html += '<br>' + '[' + m.destLang + '] ' + m.translated;
            }
            html += '</p>';
            chat.innerHTML += html;
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
        sendText.value = '';
        sendMessage({ action: 'message', user: user, content: content });
    });
}

function sendMessage(message) {
    const rawMessage = JSON.stringify(message);
    console.log('sendMessage: ' + rawMessage);
    connection.send(rawMessage);
}

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
} else {
    get_config();
}

