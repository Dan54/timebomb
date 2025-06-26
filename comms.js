'use strict';
import {Peer} from "https://esm.sh/peerjs@1.5.4?bundle-deps";

let peer = null;
let conn = null;
let clients = null;
let localId = null;
let nextId = 0;

export function createServer(cb) {
    peer = new Peer();
    clients = new Map();
    peer.on('open', function(id) {
        peer.on('connection', function(connection) {
            const cid = nextId;
            nextId += 1;
            clients.set(cid, connection);
            connection.on('data', function(data) {
                serverHandlers[data.type](cid, data.data);
            });
            connection.on('error', (err) => console.error(err));
            connection.on('open', () => {
                sendToClient(cid, 'connect', {id: cid});
                serverHandlers['connect'](cid, null);
            })
        });
        cb(id);
    });
}

export function disconnect() {
    conn?.close();
    peer?.disconnect();
    conn = null;
    peer = null;
}

export function connectToServer(serverId) {
    if (conn !== null) {
        return;
    }
    peer = new Peer();
    peer.on('open', function() {
        conn = peer.connect(serverId, {reliable: true});
        conn.on('data', recieveFromServer);
        conn.on('error', (err) => console.error(err));
    });
}

export function connectToLocal() {
    localId = nextId;
    nextId += 1;
    sendToServer('connect', null);
    sendToClient(localId, 'connect', {id: localId});
}

export const clientHandlers = {};
export const serverHandlers = {};

function recieveFromServer(data) {
    clientHandlers[data.type](data.data);
}

export function sendToClient(id, msgType, data) {
    const message = {type: msgType, data: data};
    if (id === localId) {
        setTimeout(() => recieveFromServer(message));
    }
    else {
        clients.get(id).send(message);
    }
}

export function broadcast(msgType, data) {
    clients.keys().forEach(client => {
        sendToClient(client, msgType, data);
    });
    if (localId !== null) {
        sendToClient(localId, msgType, data);
    }
}

export function sendToServer(msgType, data) {
    if (localId !== null) {
        setTimeout(() => serverHandlers[msgType](localId, data));
    }
    else {
        conn.send({type: msgType, data: data});
    }
}
