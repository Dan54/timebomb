import {connectToServer, sendToServer} from "./comms.js";
import {} from "./client.js";
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
    <div>Name: <input id="playerName" /></div>
    <button id="startGame">Start Game</button>`;
    document.getElementById("start-box-content").insertAdjacentHTML('beforeend', 
        `<div id="setupSection">
        <button id="startGame">Start Game</button>
        </div>`);
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

if (hostId) {
    connectToServer(hostId);
    document.getElementById("connectSection").innerHTML = `<div>Name: <input id="playerName" /><button id="setName">Confirm</button></div>`;
    document.getElementById('setName').addEventListener("click", () => {
        sendToServer('set-name', document.getElementById('playerName').value);
        document.getElementById('modal').style.display = 'none';
    });
}
else {
    document.getElementById("connectButton").addEventListener("click", () => {
        connectToServer(document.getElementById("serverId").value);
        document.getElementById("connectSection").innerHTML = `<div>Name: <input id="playerName" /><button id="setName">Confirm</button></div>`;
        document.getElementById('setName').addEventListener("click", () => {
            sendToServer('set-name', document.getElementById('playerName').value);
            document.getElementById('modal').style.display = 'none';
        });
    });
    document.getElementById("startButton").addEventListener("click", () => {
        document.getElementById("connectSection").innerHTML = '';
        startServer();
    });
}