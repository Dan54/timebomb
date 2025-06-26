import { createServer, serverHandlers, sendToClient, broadcast, connectToLocal } from "./comms.js";

let canJoin = true;
let players = new Map();

serverHandlers['connect'] = function(id, data) {
    if (canJoin) {
        players.set(id, {});
    }
};

let startCb;

export function setStartCb(cb) {
    startCb = cb;
}

export function startServer() {
    createServer(startCb);
    connectToLocal();
}

let blacksLeft = 0;
let jokersLeft = 0;
let primerLeft = 0;
let numPlayers = 0;
let curPicker = 0;
let pickedThisRound = 0;
const cardBack = '&#x1F0A0;';
let firstPlayer = -1;

let goodIn = 0;
let badIn = 0;
let redAceIn = 0;
let blackAceIn = 0;
let cardsPerPlayer = 4;

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

export function startGame() {
    canJoin = false;
    numPlayers = players.size;
    blacksLeft = numPlayers;
    jokersLeft = 2;
    primerLeft = 1;
    if (goodIn + badIn + redAceIn + blackAceIn < numPlayers) {
        if (numPlayers === 4 || numPlayers === 5) {
            goodIn = 4;
            badIn = 2;
            redAceIn = 1;
            blackAceIn = 0;
        }
        else {
            badIn = Math.floor((numPlayers + 2) / 3);
            goodIn = badIn * 2;
            redAceIn = 1;
            blackAceIn = 1;
        }
    }
    console.log(badIn, goodIn, redAceIn, blackAceIn);
    let roleList = new Array(goodIn).fill('good').concat(new Array(badIn).fill('bad')).concat(new Array(redAceIn).fill('red-ace')).concat(new Array(blackAceIn).fill('black-ace'));
    curPicker = players.keys().next().value;
    firstPlayer = curPicker;
    broadcast('start-game', {firstPlayer: curPicker, players: Array.from(players.keys())});
    shuffleArray(roleList);
    players.forEach((playerData, id) => { // (value, key) for some reason
        let role = roleList.pop();
        playerData.role = role;
        sendToClient(id, 'set-role', role);
    });
    startRound();
}

function startRound() {
    let cardList = new Array(numPlayers * cardsPerPlayer).fill('R');
    let i = 0;
    pickedThisRound = 0;
    for (let c = 0; c < blacksLeft; c++) {
        cardList[i++] = 'B';
    }
    for (let c = 0; c < jokersLeft; c++) {
        cardList[i++] = 'J';
    }
    for (let c = 0; c < primerLeft; c++) {
        cardList[i++] = '&clubs;';
    }
    cardList[i] = '&spades;';
    shuffleArray(cardList);
    i = 0;
    broadcast('start-round', cardsPerPlayer);
    players.forEach((playerData, id) => {
        let cards = cardList.slice(i, i + 4);
        i += 4;
        playerData.cards = cards;
        playerData.displayHand = new Array(cardsPerPlayer).fill(cardBack);
        sendToClient(id, 'set-cards', cards);
    });
}

function pickCard(id, data) {
    if (id !== curPicker) {
        return;
    }
    let pickee = data.pickee;
    if (pickee == id) {
        return;
    }
    let cardIndex = data.cardIndex;
    let cards = players.get(pickee).cards;
    let displayHand = players.get(pickee).displayHand;
    if (cardIndex < 0 || cardIndex >= displayHand.length || displayHand[cardIndex] !== cardBack) {
        return;
    }
    shuffleArray(cards);
    let card = cards.pop();
    displayHand[cardIndex] = card;
    curPicker = pickee;
    broadcast('card-picked', {picker: id, pickee: pickee, hand: displayHand});
    sendToClient(pickee, 'set-cards', cards);
}
serverHandlers['pick-card'] = pickCard;

serverHandlers['set-name'] = function(id, name) {
    broadcast('change-name', {playerId: id, name: name});
}