import EventEmitter from 'events';
import pako from 'pako'

import {
    OPCODES,
    STRING_OPCODES
} from './protocol';
import {
    unpackPixel,
    packPixel
} from './utils';
import {
    boardWidth,
    boardHeight
} from './config'
import globals from './globals'

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
            this.emit('opened');
            console.log('Socket has been connected');
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
        // must be ping
        if (!message.byteLength) return;

        if (typeof message === 'string') {
            this.onStringMessage(message);
        } else {
            this.onBinaryMessage(message);
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
                //const id = dv.getUint32(5); // применение пока не найдено

                this.emit('place', x, y, col) //, id);

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
        if (c < 0) return;
        let oldC = globals.chunkManager.getChunkPixel(x, y);
        if (oldC === c || c === -1) return;
        if (x < 0 || x >= boardWidth ||
            y < 0 || x >= boardHeight) {

            return
        }

        let dv = new DataView(new ArrayBuffer(1 + 4))

        dv.setUint8(0, OPCODES.place);
        dv.setUint32(1, packPixel(x | 0, y | 0, c));

        this.socket.send(dv.buffer)
    }
}