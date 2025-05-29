import { sendToServer, clientHandlers } from "./comms.js";

clientHandlers['chat'] = function(data) {
    console.log(data);
};

clientHandlers['connect'] = function(data) {
    console.log(`Connected to server, we are ${data.id}`);
};

export function sendMessage(msg) {
    sendToServer('chat', msg);
}
