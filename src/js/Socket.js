import EventEmitter from 'events';
import pako from 'pako'

import {
    OPCODES,
    STRING_OPCODES,
    unpackPixel,
    packPixel
} from './protocol';
import {
    canvasId,
    canvasName
} from './config'
import globals from './globals'
import User from './user';
import chat from './chat';
import { captchaModal } from './windows';
import Window from './Window';
import player from './player';
import { updatePlaced } from './actions';
import { translate } from './translate';

export default class Socket extends EventEmitter {
    constructor(port) {
        super();

        const scheme = location.protocol.startsWith('https') ? 'wss' : 'ws';
        const host = location.hostname || 'localhost';
        this.url = `${scheme}://${host}:${port}`;

        this.pendingPixels = {};

        this.connectedOnce = false;

        this.connect();
    }

    get connected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN
    }

    connect() {
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
            this.sendChatSubscribe('global', this.connectedOnce);
            this.sendChatSubscribe(canvasName, this.connectedOnce);
            this.sendCanvas(canvasId);

            this.emit('opened');
            console.log('Socket has been connected');

            if(!this.connectedOnce) this.connectedOnce = true;
        }

        this.socket.onmessage = this.onmessage.bind(this);

        this.socket.onclose = () => {
            this.emit('closed');
            Object.values(globals.users).forEach(u => u.close(u.id));
            globals.users = {};

            globals.chunkManager.clearLoadingChunks();

            setTimeout(() => {
                console.log('reconnect');
                this.reconnect();
            }, Math.random()*1000);
        }
    }

    close(){
        this.socket.close();
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
                    userId,
                    id,
                    registered,
                    role,
                    badges
                } = decoded;

                const badgesParsed = badges?.split('|').filter(x => x.length).map(x => +x);

                let sameUser;
                if(name){
                    sameUser = Object.values(globals.users).find(u => u.name === name);
                }

                if(sameUser){
                    globals.users[id] = sameUser;
                    sameUser.newConnection(id);
                }else{
                    globals.users[id] = new User(name, id, userId, registered, role, badgesParsed);
                }

                break
            }

            case STRING_OPCODES.userLeave: {
                const id = decoded.id;

                if (globals.users[id]) globals.users[id].close(id);

                break
            }

            case STRING_OPCODES.error: {
                decoded.errors.forEach(error => {
                    if(error === 'error.captcha'){
                        if(!Window.Exists('Captcha'))
                            captchaModal();
                    }
                    toastr.error(error, translate('Error from the Socket:'), {
                        preventDuplicates: true
                    });
                });

                break;
            }

            case STRING_OPCODES.chatMessage: {
                chat.addMessage(decoded)

                break
            }

            case STRING_OPCODES.alert: {
                // todo нормальный попап
                toastr.info(decoded.msg, 'ALERT', {
                    timeOut: 1000*60*5,
                    extendedTimeOut: 1000*60*5
                })
                break
            }

            case STRING_OPCODES.me: {
                player.id = decoded.id;
                break
            }

            case STRING_OPCODES.reload: {
                location.reload();
                break
            }

            case STRING_OPCODES.reloadChunks: {
                globals.chunkManager.reloadChunks();
                break
            }
        }
    }

    onBinaryMessage(msg) {
        const dv = new DataView(msg);

        switch (dv.getUint8(0)) {
            case OPCODES.captcha: {
                captchaModal();
                break
            }
            case OPCODES.chunk: {
                const cx = dv.getUint8(1);
                const cy = dv.getUint8(2);

                const chunkData = pako.inflate(dv.buffer.slice(3));

                this.emit('chunk', cx, cy, chunkData);

                break
            }

            case OPCODES.place: {
                const x = dv.getUint16(1);
                const y = dv.getUint16(3);
                const col = dv.getUint8(5);

                const id = dv.getUint32(5);

                this.onIncomingPixel([x, y, col], id);
                break
            }

            case OPCODES.online: {
                const count = dv.getUint16(1);

                this.emit('online', count);
                break
            }

            case OPCODES.pixels: {
                const isProtect = !!dv.getUint8(1),
                    uid = dv.getUint32(2, false);
                let x, y, col;
                for(let i = 6; i < dv.byteLength; i+=5){
                    x = dv.getUint16(i);
                    y = dv.getUint16(i+2);
                    col = dv.getUint8(i+4);
                    if(isProtect){
                        this.emit('protect', x, y, col);
                    }else{
                        this.emit('place', x, y, col, uid);
                    }
                }

                const user = globals.users[uid];
                if(user) user.updateCoords(col, x, y);
                
                break
            }

            case OPCODES.ping: {
                this.socket.send(new Uint8Array([OPCODES.ping]));
                break
            }

            case OPCODES.placeBatch: {
                const PIXEL_LENGTH = 9;

                const totalPixels = (dv.byteLength-1) / PIXEL_LENGTH;
                if(totalPixels % 1 !== 0){
                    console.warn('TotalPixels length is not integer');
                }

                for(let off = 1; off < dv.byteLength; off += PIXEL_LENGTH){
                    const x = dv.getUint16(off);
                    const y = dv.getUint16(off+2);
                    const c = dv.getUint8(off+4);
                    const placerId = dv.getUint32(off+5);

                    this.onIncomingPixel([x, y, c], placerId);
                }
                break
            }
        }
    }

    onIncomingPixel([x, y, col], id){
        const user = globals.users[id];
        if(user) user.updateCoords(col, x, y);

        const key = x + ',' + y;
        let timeout = this.pendingPixels[key];
        if(timeout){
            clearTimeout(timeout);
            delete this.pendingPixels[key];
        }

        this.emit('place', x, y, col, id);

        // does not work, id is not player id
        if(id === player.id)
            updatePlaced(player.placedCount++);
    }

    requestChunk(x, y) {
        let dv = new DataView(new ArrayBuffer(1 + 1 + 1));
        dv.setUint8(0, OPCODES.chunk);
        dv.setUint8(1, x);
        dv.setUint8(2, y);

        this.socket.send(dv.buffer)
    }

    sendPixel(x, y, c) {
        let dv = new DataView(new ArrayBuffer(1 + 5))

        dv.setUint8(0, OPCODES.place);
        dv.setUint16(1, x);
        dv.setUint16(3, y);
        dv.setUint8(5, c);

        this.socket.send(dv.buffer);
    }

    sendPixels(pixels, isProtect=false) {
        let dv = new DataView(new ArrayBuffer(6 + pixels.length*5))

        dv.setUint8(0, OPCODES.pixels);
        dv.setUint8(1, isProtect ? 1 : 0); // isProtect
        for(let i = 0; i < pixels.length; i++){
            let offset = i*5 + 6;
            const [x, y, col] = pixels[i];

            dv.setUint16(offset, x);
            dv.setUint16(offset+2, y);
            dv.setUint8(offset+4, col);
        }

        this.socket.send(dv.buffer)
    }

    sendCanvas(id) {
        const dv = new DataView(new ArrayBuffer(2));
        dv.setUint8(0, OPCODES.canvas);
        dv.setUint8(1, id);

        this.socket.send(dv.buffer);
    }

    sendChatSubscribe(channel, isReconnect){
        const packet = {
            c: STRING_OPCODES.subscribeChat,
            ch: channel,
            reconnect: isReconnect
        }

        this.socket.send(JSON.stringify(packet));
    }

    sendChatMessage(text, channel, whisper=false) {
        const packet = {
            c: STRING_OPCODES.chatMessage,
            msg: text,
            ch: channel
        }

        if(whisper) packet.whisper = whisper;

        this.socket.send(JSON.stringify(packet));
    }

    sendChatWhisper(text, channel, whisperId){
        return this.sendChatMessage(text, channel, whisperId);
    }

    sendAlert(to, text){
        const packet = {
            c: STRING_OPCODES.alert,
            to,
            msg: text
        }

        this.socket.send(JSON.stringify(packet));
    }
}