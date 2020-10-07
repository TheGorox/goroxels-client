import EventEmitter from 'events';
import pako from 'pako'

import {
    OPCODES,
    STRING_OPCODES,
    unpackPixel,
    packPixel
} from './protocol';
import {
    boardWidth,
    boardHeight,
    canvasId
} from './config'
import globals from './globals'
import {
    updateMe
} from './actions'
import User from './user';

function htmlspecialchars(text){
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export default class Socket extends EventEmitter {
    constructor(port) {
        super();

        const scheme = location.protocol.startsWith('https') ? 'wss' : 'ws';
        const host = location.hostname || 'localhost';
        this.url = `${scheme}://${host}:${port}`;

        this.connect();
    }

    get connected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN
    }

    connect() {
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
            this.sendCanvas(canvasId);

            this.emit('opened');
            console.log('Socket has been connected');

            updateMe();
        }

        this.socket.onmessage = this.onmessage.bind(this);
    }

    reconnect() {
        this.socket.onmessage = null;
        this.socket.onopen = null;
        this.socket.onclose = null;

        this.connect();
    }

    onmessage({
        data: message
    }) {
        if (typeof message === 'string') {
            this.onStringMessage(message);
        } else {
            // must be ping
            if (!message.byteLength) return;

            this.onBinaryMessage(message);
        }
    }

    onStringMessage(msg) {
        let decoded;
        try {
            decoded = JSON.parse(msg);
        } catch (e) {
            console.log('onStringMessage message decoding error: ' + e, 'message: ' + msg);
            return
        }

        switch (decoded.c) {
            case STRING_OPCODES.userJoin: {
                const {
                    nick: name,
                    id,
                    registered
                } = decoded;

                if (globals.users[id]) globals.users[id].destroy();

                globals.users[id] = new User(name, id, registered);

                break
            }

            case STRING_OPCODES.userLeave: {
                const id = decoded.id;

                if (globals.users[id]) globals.users[id].destroy();

                break
            }

            case STRING_OPCODES.error: {
                decoded.errors.forEach(error => toastr.error(error));

                break;
            }

            case STRING_OPCODES.chatMessage: {
                const msg = decoded.msg,
                    nick = decoded.nick,
                    isServer = decoded.server;

                const msgEl = $(
                `<div class="chatMessage">
                    <div class="messageNick">${nick}:</div>
                    <div class="messageText">${isServer ? msg : htmlspecialchars(msg)}</div>
                </div>`)

                if(!nick.length) msgEl[0].children[0].remove();

                $('#chatLog').append(msgEl);

                $('#chatLog')[0].scrollBy(0, 999);

                break
            }
        }
    }

    onBinaryMessage(msg) {
        const dv = new DataView(msg);

        switch (dv.getUint8(0)) {
            case OPCODES.chunk: {
                const cx = dv.getUint8(1);
                const cy = dv.getUint8(2);

                const chunkData = pako.inflate(dv.buffer.slice(3));

                this.emit('chunk', cx, cy, chunkData);

                break
            }

            case OPCODES.place: {
                const [x, y, col] = unpackPixel(dv.getUint32(1));
                const id = dv.getUint32(5);

                // todo replace it somewhere
                const user = globals.users[id];
                if(user) user.updateCoords(col, x, y);

                this.emit('place', x, y, col, id);

                break
            }

            case OPCODES.online: {
                const count = dv.getUint16(1);

                this.emit('online', count);
            }
        }
    }

    requestChunk(x, y) {
        let dv = new DataView(new ArrayBuffer(1 + 1 + 1));
        dv.setUint8(0, OPCODES.chunk);
        dv.setUint8(1, x);
        dv.setUint8(2, y);

        this.socket.send(dv.buffer)
    }

    sendPixel(x, y, c) {
        // if (c < 0) return;
        // let oldC = globals.chunkManager.getChunkPixel(x, y);
        // if (oldC === c || c === -1) return;
        // if (x < 0 || x >= boardWidth ||
        //     y < 0 || y >= boardHeight) {
        //     return
        // }

        let dv = new DataView(new ArrayBuffer(1 + 4))

        dv.setUint8(0, OPCODES.place);
        dv.setUint32(1, packPixel(x | 0, y | 0, c));

        this.socket.send(dv.buffer);
    }

    sendCanvas(id) {
        const dv = new DataView(new ArrayBuffer(2));
        dv.setUint8(0, OPCODES.canvas);
        dv.setUint8(1, id);

        this.socket.send(dv.buffer);
    }

    sendChatMessage(text, channel) {
        const packet = {
            c: STRING_OPCODES.chatMessage,
            msg: text,
            ch: channel
        }

        this.socket.send(JSON.stringify(packet));
    }
}