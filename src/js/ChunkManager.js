import globals from './globals';
import Chunk from './Chunk';
import {
    bgrPalette,
    argbToId,
    boardWidth, boardHeight, chunkSize, canvasId
} from './config';
import {
    boardToChunk
} from './utils/conversions'
import { apiRequest } from './actions';
import Pako from 'pako';

export default class ChunkManager {
    constructor() {
        this.chunks = new Map();

        this.loadingChunks = new Set();

        // globals.socket.on('chunk', (cx, cy, cdata) => {
        //     let key = this.getChunkKey(cx, cy);
        //     if (this.loadingChunks.has(key)){
        //         this.loadingChunks.delete(key);
        //     }

        //     let chunk = new Chunk(cx, cy, cdata);
        //     this.chunks.set(key, chunk);

        //     globals.renderer.needRender = true;
        // })

        globals.socket.on('place', (x, y, col) => {
            this.setChunkPixel(x, y, col);

            globals.renderer.needRender = true;
        })

        globals.socket.on('protect', (x, y, state) => {
            this.setProtect(x, y, state);
            
            globals.renderer.needRender = true;
        })
    }

    getChunkKey(x, y) {
        return x << 4 | y
    }

    reloadChunks(){
        this.test = true;
        let loadQueue = [...this.chunks.values()];
        const interval = setInterval(() => {
            if(this.loadingChunks.size < 3){
                const chunk = loadQueue.pop();
                if(!chunk){
                    return clearInterval(interval);
                }
                this.loadChunk(chunk.x, chunk.y);
            }
        }, 30)
    }

    loadChunk(x, y) {
        let key = this.getChunkKey(x, y);

        if (globals.socket.connected && !this.loadingChunks.has(key) && this.loadingChunks.size < 5) {
            this.loadingChunks.add(key);
            // globals.socket.requestChunk(x, y);
            apiRequest(`/getchunk?canvas=${canvasId}&x=${x}&y=${y}`).then(async (resp) => {
                
                let key = this.getChunkKey(x, y);
                if (this.loadingChunks.has(key)){
                    this.loadingChunks.delete(key);
                }

                // use pako only if chunk got from socket
                // const cdataCompressed = await resp.arrayBuffer();
                // const cdata = Pako.inflate(cdataCompressed);

                const cdata = await resp.arrayBuffer();

                let chunk = new Chunk(x, y, new Uint8Array(cdata));
                this.chunks.set(key, chunk);

                globals.renderer.needRender = true;
            });
        }
    }

    clearLoadingChunks(){
        this.loadingChunks = new Set;
    }

    hasChunk(x, y) {
        let key = this.getChunkKey(x, y);

        return this.chunks.has(key);
    }

    getChunk(x, y) {
        let key = this.getChunkKey(x, y);

        if (!this.chunks.has(key)) {
            return 0
        }
        return this.chunks.get(key)
    }

    getChunkPixel(x, y) {
        let [cx, cy, offx, offy] = boardToChunk(x, y);
        let chunk = this.getChunk(cx, cy);

        if (!chunk || x < 0 || y < 0) return -1

        let argb = chunk.get(offx, offy);

        return argbToId[argb]
    }

    setChunkPixel(x, y, col) {
        let [cx, cy, offx, offy] = boardToChunk(x, y);

        let key = this.getChunkKey(cx, cy);
        if (this.chunks.has(key)) {
            this.chunks.get(key).set(offx, offy, bgrPalette[col])
        }
    }

    setProtect(x, y, state){
        let [cx, cy, offx, offy] = boardToChunk(x, y);

        let key = this.getChunkKey(cx, cy);
        if (this.chunks.has(key)) {
            this.chunks.get(key).setProtect(offx, offy, state)
        }
    }

    getProtect(x, y){
        let [cx, cy, offx, offy] = boardToChunk(x, y);
        let chunk = this.getChunk(cx, cy);
        if (!chunk) return -1

        return chunk.getProtect(offx, offy);
    }

    // for the screenshot function
    dumpAll(){
        const canvas = document.createElement('canvas');
        canvas.width = boardWidth;
        canvas.height = boardHeight;

        const ctx = canvas.getContext('2d');

        this.chunks.forEach(chunk => {
            if(!chunk.canvas) return;

            const offX = chunk.x * chunkSize,
                offY = chunk.y * chunkSize;
            
            ctx.drawImage(chunk.canvas, offX, offY)
        })
        return canvas
    }
}