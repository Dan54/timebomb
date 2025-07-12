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
            const connectData = {established: false};
            connection.on('data', function(data) {
                if (connectData.established && !data.isControl) {
                    serverHandlers[data.type](connectData.cid, data.data);
                }
                else  {
                    switch (data.type) {
                        case 'new-client':
                            const cid = nextId;
                            nextId += 1;
                            clients.set(cid, connection);
                            connectData.established = true;
                            connectData.cid = cid;
                            curHeartbeat?.push(connectData.cid); // if heartbeat in progress, mark as connected
                            sendToClient(cid, 'connect', {id: cid});
                            serverHandlers['connect'](cid, null);
                            break;
                        case 'rejoin':
                            doHeartbeat((liveClients) => {
                                const cid = data.rejoinId;
                                if (liveClients.indexOf(cid) === -1) {
                                    // allow usurpation, old client is disconnected
                                    clients.get(cid)?.close();
                                    clients.set(cid, connection);
                                    connectData.cid = cid;
                                    connectData.established = true;
                                    curHeartbeat?.push(connectData.cid); // if heartbeat in progress, mark as connected
                                    sendToClient(cid, 'rejoin-success', {id: cid});
                                    serverHandlers['rejoin'](cid, null);
                                }
                                else {
                                    // refuse usurpation, notify attempted rejoiner
                                    connection.send({type: 'rejoin-fail', data: null, isControl: false});
                                }
                            });
                            break;
                        case 'heartbeat':
                            if (data.index === heartbeatIndex) {
                                curHeartbeat?.push(connectData.cid);
                            }
                            break;
                    }
                }
            });
            connection.on('error', (err) => console.error(err));
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

export function connectToServer(serverId, callback) {
    if (conn !== null) {
        return;
    }
    peer = new Peer();
    peer.on('open', function() {
        conn = peer.connect(serverId, {reliable: true});
        conn.on('data', recieveFromServer);
        conn.on('error', (err) => console.error(err));
        conn.on('open', callback);
    });
}

export function connectAsNewId() {
    conn.send({type: 'new-client', isControl: true});
}

export function rejoinAs(id) {
    conn.send({type: 'rejoin', isControl: true, rejoinId: id});
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
    if (!data.isControl) {
        clientHandlers[data.type](data.data);
    }
    else {
        switch (data.type) {
            case 'heartbeat':
                conn.send(data); // we can just send the exact same data back
                break;
        }
    }
}

export function sendToClient(id, msgType, data) {
    const message = {type: msgType, data: data, isControl: false};
    if (id === localId) {
        setTimeout(() => recieveFromServer(message));
    }
    else {
        clients.get(id).send(message);
    }
}

export function broadcast(msgType, data) {
    for (const client of clients.keys()) {
        sendToClient(client, msgType, data);
    }
    if (localId !== null) {
        sendToClient(localId, msgType, data);
    }
}

export function sendToServer(msgType, data) {
    if (localId !== null) {
        setTimeout(() => serverHandlers[msgType](localId, data));
    }
    else {
        conn.send({type: msgType, data: data, isControl: false});
    }
}

export let heartbeatReturned = [];
let curHeartbeat = null;
let heartbeatIndex = 0;
let heartbeatCallbacks = null;

export function doHeartbeat(callback) {
    if (curHeartbeat) {
        heartbeatCallbacks.push(callback);
    }
    else {
        curHeartbeat = [];
        heartbeatCallbacks = [callback];
        clients.forEach((conn, id) => {
            if (conn.open) {
                conn.send({isControl: true, type: 'heartbeat', index: heartbeatIndex});
            }
        })
        if (localId !== null) {
            curHeartbeat.push(localId);
        }
        setTimeout(() => {
            heartbeatReturned = curHeartbeat;
            heartbeatIndex += 1;
            curHeartbeat = null;
            heartbeatCallbacks.forEach((cb) => cb(heartbeatReturned));
        }, 2000);
    }
}

export function getHost() {
    return conn?.peer;
}