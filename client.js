import { sendToServer, clientHandlers } from "./comms.js";
import { showUsernamePrompt } from "./connect.js";

const cardBack = '&#x1F0A0;';

let myId = -1;
let playerElements = new Map();
let picker = -1;
let playerData = new Map();
let isBlackAce = false;

clientHandlers['connect'] = function(data) {
    console.log(`Connected to server, we are ${data.id}`);
    myId = data.id;
    showUsernamePrompt();
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
        span.innerHTML = card.replaceAll('<', '&lt;');
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
    for (const playerId of playerElements.keys()) {
        setDisplayHand(playerId, displayHand);
    }
};

clientHandlers['start-game'] = function(data) {
    document.getElementById('otherPlayers').innerHTML = '';
    if (!document.getElementById('connectSection')) { // hide the result dialog if showing
        document.getElementById('modal').style.display = 'none';
    }
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
    let roleText = "Unknown";
    let goal = "Unknown";
    isBlackAce = false;
    switch (role) {
        case 'good':
            roleText = "Good";
            goal = "Pick all the blacks, do not explode";
            break;
        case 'bad':
            roleText = "Bad";
            goal = "Get the bomb picked";
            break;
        case 'black-ace':
            roleText = "Black ace";
            goal = "Don't get picked";
            isBlackAce = true;
            break;
        case 'red-ace':
            roleText = "Red ace";
            goal = "Pick the last card";
            break;
    }
    document.getElementById("myRole").innerText = `Role: ${roleText}`;
    document.getElementById("goal").innerText = goal;
};

clientHandlers['set-cards'] = function(cards) {
    cards.sort();
    document.getElementById('hiddenHand').innerHTML = cards.join('').replaceAll('<', '&lt;');
};

clientHandlers['card-picked'] = function(data) {
    playerElements.get(picker).classList.remove('inPower');
    if (data.pickee === myId && isBlackAce) {
        document.getElementById("goal").innerText = `You are on ${playerData.get(picker).name}'s team`;
        isBlackAce = false;
    }
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

clientHandlers['game-over'] = function(data) {
    document.getElementById("connectSection")?.remove();
    document.getElementById("resultsSection")?.remove();
    let resultSect = document.createElement('div');
    resultSect.id = "resultsSection";
    resultSect.innerHTML = `<div id="resultHeadline"></div><div id="winners">Winners:</div><div id="losers">Losers:</div>`;
    document.getElementById('start-box-content').insertAdjacentElement('afterbegin', resultSect);
    document.getElementById('resultHeadline').innerText = data.headline;
    let winnerElem = document.getElementById('winners');
    data.winners.forEach((g) => {
        let para = document.createElement('p');
        console.log(g);
        para.innerText = `${g[0]}: ${g[1]}`;
        winnerElem.insertAdjacentElement('beforeend', para);
    });
    let loserElem = document.getElementById('losers');
    data.losers.forEach((g) => {
        let para = document.createElement('p');
        console.log(g);
        para.innerText = `${g[0]}: ${g[1]}`;
        loserElem.insertAdjacentElement('beforeend', para);
    });
    document.getElementById('modal').style.display = 'flex';
}