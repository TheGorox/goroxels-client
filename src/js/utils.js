import camera from './camera';

export function packPixel(x, y, col){
    return (x << 12 | y) << 7 | col
}

export function unpackPixel(num){
    return [
        num >>> 19,
        num >>> 7 & 0xFFF,
        num & 0b1111111
    ]
}

export function screenToBoardSpace(clientX, clientY){
    let x = ((clientX - window.innerWidth / 2) / camera.zoom) + camera.x,
        y = ((clientY - window.innerHeight / 2) / camera.zoom) + camera.y

    return [x, y]
}

export function getVisibleChunks(){
    let startX = screenToBoardSpace(0, 0);
    
}