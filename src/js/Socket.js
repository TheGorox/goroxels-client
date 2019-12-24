import EventEmitter from 'events';
import pako from 'pako'

import { OPCODES, STRING_OPCODES } from './protocol';
import { unpackPixel } from './utils';

export default class Socket extends EventEmitter{
    constructor(port){
        const scheme = location.protocol.startsWith('https') ? 'wss' : 'ws';
        const host = location.hostname;
        this.url = `${scheme}://${host}:${port}`;

        this.connect();
    }

    get connected(){
        return this.socket && this.socket.readyState === WebSocket.OPEN
    }

    connect(){
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('Socket has been connected');
        }

        this.socket.onmessage = this.onmessage.bind(this);
    }

    reconnect(){
        this.socket.onmessage = null;
        this.socket.onopen = null;
        this.socket.onclose = null;

        this.connect();
    }

    onmessage({data: message}){
        // must be ping
        if(!data.length) return;

        if(typeof message === 'string'){
            this.onStringMessage(message);
        }else{
            this.onBinaryMessage(message);
        }
    }

    onBinaryMessage(msg){
        const dv = new DataView(msg);

        switch(dv.getUint8(0)){
            case OPCODES.chunk: {
                const cx = dv.getUint8(1);
                const cy = dv.getUint8(2);

                const chunkData = pako.inflate(dv.buffer.slice(3));

                this.emit('chunk', cx, cy, chunkData);

                break
            }

            case OPCODES.place: {
                const [x, y, col] = unpackPixel(dv.getUint32(1));
                const id = dv.getUint32(5); // применение пока не найдено

                this.emit('place', x, y, col, id);

                break
            }
        }
    }
}