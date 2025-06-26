import { sendToServer, clientHandlers } from "./comms.js";

const cardBack = '&#x1F0A0;';

let myId = -1;
let players = new Map();
let picker = -1;

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
    players.set(id, ops.lastElementChild);
}

function setDisplayHand(playerId, hand) {
    let handDiv = players.get(playerId).getElementsByClassName('displayHand')[0];
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
    players.keys().forEach((playerId) => {
        setDisplayHand(playerId, displayHand);
    });
};

clientHandlers['start-game'] = function(data) {
    document.getElementById('otherPlayers').innerHTML = '';
    data.players.forEach(pid => {
        if (pid !== myId || true) {
            createOtherPlayer(pid);
        }
    });
    picker = data.firstPlayer;
    players.get(picker).classList.add('inPower');
};

clientHandlers['set-role'] = function(role) {

};

clientHandlers['set-cards'] = function(cards) {

};

clientHandlers['card-picked'] = function(data) {
    players.get(picker).classList.remove('inPower');
    picker = data.pickee;
    setDisplayHand(data.pickee, data.hand);
    players.get(picker).classList.add('inPower');
};
