import { sendToServer, clientHandlers } from "./comms.js";

const cardBack = '&#x1F0A0;';

let myId = -1;
let playerElements = new Map();
let picker = -1;
let playerData = new Map();

clientHandlers['connect'] = function(data) {
    console.log(`Connected to server, we are ${data.id}`);
    myId = data.id;
};

function createOtherPlayer(id) {
    let ops = document.getElementById('otherPlayers');
    ops.insertAdjacentHTML("beforeend", `<div class="player">
            <div class="name"></div>
            <div class="displayHand"></div>
        </div>`);
    playerElements.set(id, ops.lastElementChild);
    if (playerData.has(id) && playerData.get(id).name) {
        [...ops.lastElementChild.getElementsByClassName('name')].forEach((elem) => {
            elem.innerText = playerData.get(id).name;
        });
    }
}

function setDisplayHand(playerId, hand) {
    let handDiv = playerElements.get(playerId).getElementsByClassName('displayHand')[0];
    handDiv.innerHTML = ''; // clear the hand first
    for (let index = 0; index < hand.length; index++) {
        const card = hand[index];
        const span = document.createElement('span');
        span.innerHTML = card;
        handDiv.appendChild(span);
        if (playerId !== myId && card === cardBack) {
            span.addEventListener('click', () => {
                if (picker === myId) {
                    sendToServer('pick-card', {pickee: playerId, cardIndex: index});
                }
            });
        }
    }
}

clientHandlers['start-round'] = function(cardsPerPlayer) {
    let displayHand = new Array(cardsPerPlayer).fill(cardBack);
    playerElements.keys().forEach((playerId) => {
        setDisplayHand(playerId, displayHand);
    });
};

clientHandlers['start-game'] = function(data) {
    document.getElementById('otherPlayers').innerHTML = '';
    data.players.forEach(pid => {
        if (pid !== myId) {
            createOtherPlayer(pid);
        }
    });
    playerElements.set(myId, document.getElementById('myPlayer'));
    if (playerData.has(myId) && playerData.get(myId).name) {
        [...document.getElementById('myPlayer').getElementsByClassName('name')].forEach((elem) => {
            elem.innerText = playerData.get(myId).name;
        });
    }
    picker = data.firstPlayer;
    playerElements.get(picker).classList.add('inPower');
};

clientHandlers['set-role'] = function(role) {

};

clientHandlers['set-cards'] = function(cards) {
    cards.sort();
    document.getElementById('hiddenHand').innerHTML = cards.join('');
};

clientHandlers['card-picked'] = function(data) {
    playerElements.get(picker).classList.remove('inPower');
    picker = data.pickee;
    setDisplayHand(data.pickee, data.hand);
    playerElements.get(picker).classList.add('inPower');
};

clientHandlers['change-name'] = function(data) {
    if (!playerData.has(data.playerId)) {
        playerData.set(data.playerId, {});
    }
    playerData.get(data.playerId).name = data.name;
    if (playerElements.has(data.playerId)) {
        [...playerElements.get(data.playerId).getElementsByClassName('name')].forEach((elem) => {
            elem.innerText = data.name;
        });
    }
}

clientHandlers['update-counts'] = function(data) {
    for (const counter in data) {
        if (counter === 'scaryJokers') {
            continue;
        }
        document.getElementById(counter).innerText = data[counter];
    }
    if (data.scaryJokers) {
        document.getElementById('jokerText').classList.add('scaryJokers');
    }
    else {
        document.getElementById('jokerText').classList.remove('scaryJokers');
    }
}