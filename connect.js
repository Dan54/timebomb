import {connectToServer, disconnect, sendToServer, connectAsNewId, rejoinAs, clientHandlers} from "./comms.js";
import {setName} from "./client.js";
import {startServer, startGame, setStartCb} from "./server.js";

function generateRoomURL(roomId) {
    let url = new URL(document.location.href);
    url.searchParams.set('host', roomId);
    return url;
}

setStartCb((id) => {
    console.log(`Created server with host id: ${id}`);
    let url = generateRoomURL(id);
    
    document.getElementById("connectSection").innerHTML = `<div>
    Room Code: ${id}<br/>Room Link: ${url.href}</div>
    <button id="copyLink">Copy Room Link</button>
    <button id="shareLink">Share Room Link</button>
    <div id="nameBox">Name: <input id="playerName" /><button id="setName">Set name</button></div>
    <div id="playerNameList">Players: unnamed</div>`;
    document.getElementById("start-box-content").insertAdjacentHTML('beforeend', 
        `<div id="setupSection">
        <div><span id="playerCount">1</span> player</div>
        <div id="gameSettings">
            <div>
                <div><label for="goodCount">Good roles:</label> <input id="goodCount" type="number" min="0" value="4"></div>
                <div><label for="badCount">Bad roles:</label> <input id="badCount" type="number" min="0" value="2"></div>
            </div>
            <div>
                <div><label for="redAceCount">Red aces:</label> <input id="redAceCount" type="number" min="0" value="1"></div>
                <div><label for="blackAceCount">Black aces:</label> <input id="blackAceCount" type="number" min="0" value="0"></div>
            </div>
            <div><label for="cardCount">Cards per player:</label> <input id="cardCount" type="number" min="2" max="6" value="4"></div>
        </div>
        <button id="startGame" disabled>Start Game</button>
        </div>`);
    document.getElementById("setName").addEventListener("click", () => {
        if (document.getElementById('playerName')) {
            sendToServer('set-name', document.getElementById('playerName').value);
        }
        document.getElementById("startGame").disabled = false;
    });
    document.getElementById("startGame").addEventListener("click", () => {
        if (document.getElementById('playerName')) {
            sendToServer('set-name', document.getElementById('playerName').value);
        }
        startGame();
        document.getElementById('modal').style.display = 'none';
    });
    let shareData = {
        title: 'Timebomb',
        text: 'Join my timebomb room!',
        url: url.href,
    };
    if (navigator.canShare && navigator.canShare(shareData)) {
        document.getElementById('shareLink').addEventListener("click", () => {
            navigator.share(shareData);
        });
    }
    else {
        document.getElementById('shareLink').remove();
    }
    if (navigator.clipboard) {
        document.getElementById('copyLink').addEventListener("click", () => {
            navigator.clipboard.writeText(url.href);
        });
    }
    else {
        document.getElementById('copyLink').remove();
    }
});

let hostId = new URLSearchParams(document.location.search).get('host');
let isServer = false;
let connectionOpen = false;

export function showUsernamePrompt() {
    if (isServer) { // server UI handled elsewhere
        return;
    }
    document.getElementById("connectSection").hidden = false;
    document.getElementById("connectSection").innerHTML = `<div>Name: <input id="playerName" /><button id="setName">Set name</button></div>
    <div id="playerNameList"></div>`;
    document.getElementById('setName').addEventListener("click", () => {
        setName(document.getElementById('playerName').value);
    });
}

function requestClientId(host) {
    if (host === window.sessionStorage.getItem('host')) {
        rejoinAs(parseInt(window.sessionStorage.getItem('id')));
    }
    else if (host === window.localStorage.getItem('host')) {
        document.getElementById("connectSection").hidden = false;
        document.getElementById("connectSection").innerHTML = `<div>You have previously joined this room, would you like to rejoin?</div>
        <div><button id="reconnect">Rejoin</button><button id="joinAsNew">Join as new player</button></div>`;
        document.getElementById('reconnect').addEventListener("click", () => {
            document.getElementById("connectSection").hidden = true;
            rejoinAs(parseInt(window.localStorage.getItem('id')));
        });
        document.getElementById('joinAsNew').addEventListener("click", () => {
            document.getElementById("connectSection").hidden = true;
            connectAsNewId();
        });
    }
    else {
        connectAsNewId();
    }
}

clientHandlers['rejoin-fail'] = function(data) {
    document.getElementById("connectSection").hidden = false;
    document.getElementById("connectSection").innerHTML = `<div>Could not rejoin, make sure the original tab is closed.</div>
    <div><button id="reconnect">Rejoin</button><button id="joinAsNew">Join as new player</button></div>`;
    document.getElementById('reconnect').addEventListener("click", () => {
        document.getElementById("connectSection").hidden = true;
        rejoinAs(parseInt(window.localStorage.getItem('id')));
    });
    document.getElementById('joinAsNew').addEventListener("click", () => {
        document.getElementById("connectSection").hidden = true;
        connectAsNewId();
    });
}

if (hostId) {
    document.getElementById("connectSection").hidden = true;
    connectToServer(hostId, () => {
        connectionOpen = true;
        requestClientId(hostId);
    });
    setTimeout(() => {
        if (!connectionOpen) {
            disconnect();
            document.getElementById("connectSection").hidden = false;
            console.warn("Could not connect to provided host, showing connection UI");
        }
    }, 2000);
}
document.getElementById("connectButton").addEventListener("click", () => {
    document.getElementById("connectSection").hidden = true;
    connectToServer(document.getElementById("serverId").value, () => {
        connectionOpen = true;
        requestClientId(hostId);
    });
});
document.getElementById("startButton").addEventListener("click", () => {
    document.getElementById("connectSection").innerHTML = '';
    isServer = true;
    startServer();
});