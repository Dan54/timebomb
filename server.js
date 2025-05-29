import { createServer, serverHandlers, sendToClient, broadcast, connectToLocal } from "./comms.js";

serverHandlers['connect'] = function(id, data) {
    console.log(`Connected to client ${id}`);
};

serverHandlers['chat'] = function(id, data) {
    broadcast('chat', `${id}: ${data}`);
}

export function startServer() {
    createServer((id) => {
        console.log(`Created server with host id: ${id}`);
    });
    connectToLocal();
}
