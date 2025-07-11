import { createServer, serverHandlers, sendToClient, broadcast, connectToLocal } from "./comms.js";

let canJoin = true;
let players = new Map();

serverHandlers['connect'] = function(id, data) {
    if (canJoin) {
        players.set(id, {});
        broadcast('name-list', [...players.values()].map((p) => p.name || 'unnamed').join(', '));
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
let curPicker = -1;
let pickedThisRound = 0;
const cardBack = '&#x1F0A0;';
let firstPlayer = -1;
let scaryJokers = false;
let gameActive = false;
let betweenRounds = false;

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
    blackAceIn = parseInt(document.getElementById('blackAceCount').value || '0');
    cardsPerPlayer = parseInt(document.getElementById('cardCount').value || '4');
    if (goodIn + badIn + redAceIn + blackAceIn < numPlayers 
        || [goodIn, badIn, redAceIn, blackAceIn, cardsPerPlayer].some((n) => !Number.isInteger(n) || n < 0) 
        || cardsPerPlayer < 2) {
        setDefaultCounts();
    }
    console.log(badIn, goodIn, redAceIn, blackAceIn);
    let roleList = new Array(goodIn).fill('good').concat(new Array(badIn).fill('bad')).concat(new Array(redAceIn).fill('red-ace')).concat(new Array(blackAceIn).fill('black-ace'));
    if (!players.has(firstPlayer)) {
        firstPlayer = players.keys().next().value;
    }
    curPicker = firstPlayer;
    broadcast('start-game', {firstPlayer: firstPlayer, players: Array.from(players.keys())});
    shuffleArray(roleList);
    players.forEach((playerData, id) => { // (value, key) for some reason
        let role = roleList.pop();
        playerData.role = role;
        playerData.newRole = undefined; // reset black ace role
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
    betweenRounds = false;
}

function pickCard(id, data) {
    if (id !== curPicker || !gameActive || betweenRounds) {
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

    if (players.get(pickee).role === 'black-ace' && !players.get(pickee).newRole) { // handle black ace
        players.get(pickee).newRole = normalised_role(id);
    }

    shuffleArray(cards);
    let card = cards.pop();
    displayHand[cardIndex] = card;
    let lastPick = curPicker;
    curPicker = pickee;
    broadcast('card-picked', {picker: id, pickee: pickee, hand: displayHand});
    sendToClient(pickee, 'set-cards', cards);
    switch (card) {
        case 'B':
            blacksLeft -= 1;
            if (blacksLeft === 0) {
                goodWin(lastPick);
            }
            break;
        case 'J':
            if (scaryJokers) {
                evilWin(lastPick);
            }
            jokersLeft -= 1;
            scaryJokers = jokersLeft > 0;
            break;
        case '&clubs;':
            scaryJokers = jokersLeft > 0;
            primerLeft = 0;
            break;
        case '&spades;':
            evilWin(lastPick);
            break;
    }
    pickedThisRound += 1;
    updateCounts();
    if (pickedThisRound === numPlayers && gameActive) {
        betweenRounds = true;
        cardsPerPlayer -= 1;
        setTimeout(startRound, 3000); // start next round in 3 seconds
    }
}
serverHandlers['pick-card'] = pickCard;

function goodWin(lastPick) {
    gameActive = false;
    let aceWinners = getAceWinners(lastPick);
    let winners;
    if (aceWinners.length !== 0) {
        winners = announceWinners((id) => aceWinners.indexOf(id) !== -1, 'Ace(s) Win!');
    }
    else {
        winners = announceWinners((id) => normalised_role(id) === 'good', 'Good Team Wins!');
    }
    setNextStart(winners, lastPick);
}

function evilWin(lastPick) {
    gameActive = false;
    let aceWinners = getAceWinners(lastPick);
    let winners;
    if (aceWinners.length !== 0) {
        winners = announceWinners((id) => aceWinners.indexOf(id) !== -1, 'Ace(s) Win!');
    }
    else {
        winners = announceWinners((id) => normalised_role(id) === 'bad', 'Bad Team Wins!');
    }
    setNextStart(winners, lastPick);
}

function normalised_role(id) {
    let player = players.get(id);
    let role = player.role;
    if (role === 'black-ace' && player.newRole) {
        if (player.newRole === 'black-ace') {
            let startRole = players.get(firstPlayer).newRole;
            if (startRole === 'black-ace') {
                role = 'loser';
            }
            else if (startRole) {
                role = startRole;
            }
        }
        else {
            role = player.newRole;
        }
    }
    return role;
}

function getAceWinners(lastPick) {
    let winners = [];
    if (normalised_role(lastPick) === 'red-ace') {
        winners.push(lastPick);
    }
    for (const id of players.keys()) {
        if (normalised_role(id) === 'black-ace') {
            winners.push(id)
        }
    }
    return winners;
}

function fullRoleName(id) {
    switch (players.get(id).role) {
        case 'good':
            return 'Good';
        case 'bad':
            return 'Bad';
        case 'red-ace':
            return 'Red ace';
        case 'black-ace':
            if (players.get(id).newRole) {
                switch (normalised_role(id)) {
                    case 'good':
                        return 'Black ace (Good)';
                    case 'bad':
                        return 'Black ace (Bad)';
                    case 'red-ace':
                        return 'Black ace (Red ace)';
                    case 'black-ace':
                    case 'loser':
                        return 'Black ace (Black ace)';
                }
            }
            return 'Black ace';
    }
}

function roleOrder(role) {
    switch (role) {
        case 'Good':
            return 0;
        case 'Bad':
            return 0;
        case 'Red ace':
            return 1;
        case 'Black ace (Red ace)':
            return 2;
        case 'Black ace':
            return 3;
        case 'Black ace (Black ace)':
            return 5;
        default:
            return 4;
    }
}

function announceWinners(pred, headline) {
    let winnerSet = new Set();
    let winners = new Map();
    let losers = new Map();
    players.forEach((playerData, id) => {
        let role = fullRoleName(id);
        if (pred(id)) {
            if (!winners.has(role)) {
                winners.set(role, []);
            }
            winnerSet.add(id);
            winners.get(role).push(playerData.name);
        }
        else {
            if (!losers.has(role)) {
                losers.set(role, []);
            }
            losers.get(role).push(playerData.name);
        }
    });
    let winnerGroupArray = [...winners.entries()].map((e) => [roleOrder(e[0]), e[0], e[1].join(', ')]);
    let loserGroupArray = [...losers.entries()].map((e) => [roleOrder(e[0]), e[0], e[1].join(', ')]);
    winnerGroupArray.sort();
    loserGroupArray.sort();
    setTimeout(() => broadcast('game-over', {
        headline: headline, 
        winners: winnerGroupArray.map((g) => [g[1], g[2]]),
        losers: loserGroupArray.map((g) => [g[1], g[2]])
    }), 3000);
    return winnerSet;
}

function setNextStart(winners, lastPick) {
    if (winners.has(lastPick) && (normalised_role(lastPick) === players.get(lastPick).role || normalised_role(lastPick) === 'red-ace')) {
        firstPlayer = lastPick;
    }
    else if (winners.has(curPicker) && normalised_role(curPicker) === players.get(curPicker).role) {
        firstPlayer = curPicker;
    }
    else if (winners.size !== 0) {
        let winnerArray = [...winners];
        firstPlayer = winnerArray[Math.floor(Math.random() * winnerArray.length)];
    }
    else {
        let winnerArray = [...players.keys()];
        firstPlayer = winnerArray[Math.floor(Math.random() * winnerArray.length)];
    }
}

function showRestartScreen() {
    document.getElementById("connectSection")?.remove();
    document.getElementById("startGame").innerText = "Start New Game";
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
    broadcast('name-list', [...players.values()].map((p) => p.name || 'unnamed').join(', '));
}