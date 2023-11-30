import camera from '../camera';
import { halfMap } from './misc';
import { screenToBoardSpace } from './conversions';
import {
    chunkSize,
    boardChunkWid,
    boardChunkHei,
    boardWidth,
    boardHeight
} from '../config';

export function isAreaVisible(x, y, w, h){
    let sx = camera.x + halfMap[0],
        sy = camera.y + halfMap[1];
    
    let ex = sx + window.innerWidth / camera.zoom,
        ey = sy + window.innerHeight / camera.zoom;

    return x + w >= sx && x < ex &&
           y + h >= sy && y < ey
}

export function getVisibleChunks() {
    // todo rework it
    // rn it checks left top chunk and right bottom chunk

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

export function inBounds(x, y){
    if(x < 0 || x >= boardWidth || y < 0 || y >= boardHeight) return false;
    return true;
}