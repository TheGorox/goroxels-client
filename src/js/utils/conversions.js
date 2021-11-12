import camera from '../camera';
import globals from '../globals';
import {
    halfMap
} from './misc';
import {
    chunkSize
} from '../config';

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

    x += globals.renderer.canvas.width >> 1; // x >> 1 = x / 2
    y += globals.renderer.canvas.height >> 1;

    return [Math.floor(x), Math.floor(y)]
}

export function boardToChunk(x, y) {
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

export function chunkToBoard(cx, cy, offx, offy) {
    return [cx * chunkSize + offx, cy * chunkSize + offy]
}