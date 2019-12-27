import camera from './camera';
import {
    chunkSize,
    boardWidth,
    boardHeight,
    boardChunkWid,
    boardChunkHei
} from './config';
import globals from './globals'

export const halfMap = [
    boardWidth / 2,
    boardHeight / 2
]

export function packPixel(x, y, col) {
    return (x << 12 | y) << 7 | col
}

export function unpackPixel(num) {
    return [
        num >>> 19,
        num >>> 7 & 0xFFF,
        num & 0b1111111
    ]
}

export function screenToBoardSpace(clientX, clientY) {
    let screenOffsetX = (clientX - (globals.renderer.canvas.width >> 1)) / camera.zoom;
    let screenOffsetY = (clientY - (globals.renderer.canvas.height >> 1)) / camera.zoom;

    let boardOffsetX = camera.x + halfMap[0];
    let boardOffsetY = camera.y + halfMap[1];
    
    let x = boardOffsetX + screenOffsetX,
        y = screenOffsetY + boardOffsetY;

    return [x | 0, y | 0]
}
export function boardToScreenSpace(x, y) {
    x -= camera.x + halfMap[0];
    y -= camera.y + halfMap[1];

    x *= camera.zoom;
    y *= camera.zoom;

    x += globals.renderer.canvas.width >> 1;
    y += globals.renderer.canvas.height >> 1;

    return [x | 0, y | 0]
}

export function getVisibleChunks() {
    // todo rework it

    let [sx, sy] = screenToBoardSpace(0, 0);
    let [ex, ey] = screenToBoardSpace(window.innerWidth, window.innerHeight);


    let startX = sx / chunkSize | 0, // math floor
        endX = ex / chunkSize + 1 | 0; // math ceil

    let startY = sy / chunkSize | 0,
        endY = ey / chunkSize + 1 | 0;

    let arr = []
    for (let x = Math.max(startX, 0); x < Math.min(endX, boardChunkWid); x++) {
        for (let y = Math.max(startY, 0); y < Math.min(endY, boardChunkHei); y++) {
            arr.push([x, y]);
        }
    }

    return arr
}

export function rgb2abgr(r, g, b) {
    return 0xff000000 | b << 16 | g << 8 | r;
}

function component2hex(c){
    return c.toString(16).padStart(2, '0');
}

export function rgb2hex(rgb){
    return '#' + component2hex(rgb[0]) + component2hex(rgb[1]) + component2hex(rgb[2])
}

export function mod(n, m) {
    return ((n % m) + m) % m;
}

export function boardToChunk(x, y){
    let cx = x / chunkSize | 0;
    let cy = y / chunkSize | 0;

    let offx = x % chunkSize;
    let offy = y % chunkSize;

    return [
        cx,
        cy,
        offx,
        offy
    ]
}

export function chunkToBoard(cx, cy, offx, offy){
    return [cx * chunkSize + offx, cy * chunkSize + offy]
}