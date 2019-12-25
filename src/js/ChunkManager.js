import globals from './globals';
import Chunk from './Chunk';
import {
    palette,
    chunkSize,
    argbPalette
} from './config';

export default class ChunkManager{
    constructor(){
        this.chunks = new Map();

        this.loadingChunks = new Set();

        globals.socket.on('chunk', (cx, cy, cdata) => {
            let key = this.getChunkKey(cx, cy);
            if(!this.loadingChunks.has(key)) return
            this.loadingChunks.delete(key);

            let chunk = new Chunk(cx, cy, cdata);
            this.chunks.set(key, chunk);

            globals.renderer.render();
        })

        globals.socket.on('place', (x, y, col) => {
            let cx = x / chunkSize | 0;
            let cy = y / chunkSize | 0;

            let key = this.getChunkKey(cx, cy);
            if(this.chunks.has(key)){
                this.chunks.get(key).set(x % chunkSize, y % chunkSize, argbPalette[col])
            }

            globals.renderer.render()
        })
    }

    getChunkKey(x, y){
        return x << 4 | y
    }

    loadChunk(x, y){
        if(globals.socket.connected){
            let key = this.getChunkKey(x, y);
            globals.socket.requestChunk(x, y);

            this.loadingChunks.add(key);
        }
    }

    getChunk(x, y){
        let key = this.getChunkKey(x, y);

        //console.log(this.chunks, this.chunks.has(key), key)

        if(!this.chunks.has(key)){
            if(!this.loadingChunks.has(key) && this.loadingChunks.size < 2){
                this.loadChunk(x, y);
            }

            return 0
        }
        return this.chunks.get(key)
    }
}