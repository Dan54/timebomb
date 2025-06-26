import { createServer, serverHandlers, sendToClient, broadcast, connectToLocal } from "./comms.js";

let canJoin = true;
let players = new Map();

serverHandlers['connect'] = function(id, data) {
    if (canJoin) {
        players.set(id, {});
        if (document.getElementById("goodCount")) {
            setDefaultCounts();
            document.getElementById("goodCount").value = goodIn.toString();
            document.getElementById("badCount").value = badIn.toString();
            document.getElementById("redAceCount").value = redAceIn.toString();
            document.getElementById("blackAceCount").value = blackAceIn.toString();
            document.getElementById("cardCount").value = cardsPerPlayer.toString();
            document.getElementById("playerCount").innerText = numPlayers.toString();
        }
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
let scaryJokers = false;
let gameActive = false;

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

function setDefaultCounts() {
    numPlayers = players.size;
    if (numPlayers <= 5) {
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
    cardsPerPlayer = 4;
}

export function startGame() {
    gameActive = true;
    canJoin = false;
    numPlayers = players.size;
    blacksLeft = numPlayers;
    jokersLeft = 2;
    primerLeft = 1;
    goodIn = parseInt(document.getElementById('goodCount').value || '0');
    badIn = parseInt(document.getElementById('badCount').value || '0');
    redAceIn = parseInt(document.getElementById('redAceCount').value || '0');
    goodIn = parseInt(document.getElementById('blackAceCount').value || '0');
    cardsPerPlayer = parseInt(document.getElementById('cardCount').value || '4');
    if (goodIn + badIn + redAceIn + blackAceIn < numPlayers 
        || [goodIn, badIn, redAceIn, blackAceIn, cardsPerPlayer].some((n) => Number.isInteger(n) || n < 0) 
        || cardsPerPlayer < 2) {
        setDefaultCounts();
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
        if (playerData.name) { // make sure everyone knows the name
            broadcast('change-name', {playerId: id, name: playerData.name});
        }
    });
    startRound();
}

function startRound() {
    let cardList = new Array(numPlayers * cardsPerPlayer).fill('R');
    let i = 0;
    pickedThisRound = 0;

    scaryJokers = primerLeft === 0;
    updateCounts();

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
        let cards = cardList.slice(i, i + cardsPerPlayer);
        i += cardsPerPlayer;
        playerData.cards = cards;
        playerData.displayHand = new Array(cardsPerPlayer).fill(cardBack);
        sendToClient(id, 'set-cards', cards);
    });
}

function pickCard(id, data) {
    if (id !== curPicker || !gameActive) {
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
    switch (card) {
        case 'B':
            blacksLeft -= 1;
            if (blacksLeft === 0) {
                goodWin();
            }
            break;
        case 'J':
            if (scaryJokers) {
                evilWin();
            }
            jokersLeft -= 1;
            scaryJokers = jokersLeft > 0;
            break;
        case '&clubs;':
            scaryJokers = jokersLeft > 0;
            primerLeft = 0;
            break;
        case '&spades;':
            evilWin();
            break;
    }
    pickedThisRound += 1;
    updateCounts();
    if (pickedThisRound === numPlayers && gameActive) {
        cardsPerPlayer -= 1;
        setTimeout(startRound, 3000); // start next round in 3 seconds
    }
}
serverHandlers['pick-card'] = pickCard;

function goodWin() {
    gameActive = false;
    console.log('good win');
}

function evilWin() {
    gameActive = false;
    console.log('evil win');
}

function showRestartScreen() {
    document.getElementById("connectSection")?.remove();
    document.getElementById("startGame").innerText = "Start New game";
}

function updateCounts() {
    let data = {
        blackCount: `${numPlayers-blacksLeft}/${numPlayers}`,
        jokerCount: `${2-jokersLeft}/2`,
        primerCount: `${1-primerLeft}/1`,
        pickCount: `${numPlayers-pickedThisRound}/${numPlayers}`,
        scaryJokers: scaryJokers
    };
    broadcast('update-counts', data);
}

serverHandlers['set-name'] = function(id, name) {
    players.get(id).name = name;
    broadcast('change-name', {playerId: id, name: name});
}