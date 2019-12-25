import camera from './camera';
import {
    chunkSize,
    boardWidth,
    boardHeight,
    boardChunkWid,
    boardChunkHei
} from './config';

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
    let x = (clientX / camera.zoom) + (camera.x + halfMap[0]) - (window.innerWidth / 2 / camera.zoom),
        y = (clientY / camera.zoom) + (camera.y + halfMap[1]) - (window.innerHeight / 2 / camera.zoom)

    return [x, y]
}
export function boardToScreenSpace(x, y) {
    x -= camera.x + halfMap[0];
    y -= camera.y + halfMap[0];

    x *= camera.zoom;
    y *= camera.zoom;

    return [x + window.innerWidth / 2 | 0, y + window.innerHeight / 2 | 0]
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
        for (let y = startY; y < Math.min(endY, boardChunkHei); y++) {
            arr.push([x, y]);
        }
    }

    return arr
}

export function rgb2abgr(r, g, b) {
    return 0xff000000 | b << 16 | g << 8 | r;
}