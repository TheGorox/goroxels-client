import camera from './camera';
import {
    chunkSize,
    boardWidth,
    boardHeight,
    boardChunkWid,
    boardChunkHei
} from './config';
import globals from './globals'

import $ from 'jquery';

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

    x += globals.renderer.canvas.width >> 1; // x >> 1 = x / 2
    y += globals.renderer.canvas.height >> 1;

    return [x | 0, y | 0]
}

export function isAreaVisible(x, y, w, h){
    let sx = camera.x + halfMap[0],
        sy = camera.y + halfMap[1];
    
    let ex = sx + window.innerWidth / camera.zoom,
        ey = sy + window.innerHeight / camera.zoom;

    return x + w >= sx && x < ex &&
           y + h >= sy && y < ey
}

// export function getVisibleChunks() {
//     let arr = [];
    
//     console.log(globals.chunkManager.chunks);
//     globals.chunkManager.chunks.forEach((val, key) => {
//         let [x, y] = key;

//         if(isAreaVisible(x, y, chunkSize, chunkSize)){
//             arr.push(x, y);
//         }
//     });

//     console.log(arr)
//     return arr
// }

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

function component2hex(c) {
    return c.toString(16).padStart(2, '0');
}

export function rgb2hex(rgb) {
    return '#' + component2hex(rgb[0]) + component2hex(rgb[1]) + component2hex(rgb[2])
}

export function mod(n, m) {
    return ((n % m) + m) % m;
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

export function isDarkColor(r, g, b) {
    // V value from HSV
    return Math.max(r / 255, g / 255, b / 255) < 0.5
}

export function insanelyLongMobileBrowserCheck() {
    let check = false;
    (function (a) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}

export var shapes = {
    line: function (x, y, x2, y2) {
        let pointArr = [];

        let steep = Math.abs(y2 - y) > Math.abs(x2 - x);
        if (steep) {
            [x, y] = [y, x];
            [x2, y2] = [y2, x2];
        }
        let reverseFlag = false;
        if (x > x2) {
            [y, y2] = [y2, y];
            [x, x2] = [x2, x];
            reverseFlag = true;
        }
        let dist = {
            x: x2 - x,
            y: Math.abs(y2 - y)
        }
        let err = dist.x / 2;
        let stepY = (y < y2) ? 1 : -1;
        for (; x <= x2; x++) {
            pointArr.push([steep ? y : x, steep ? x : y]);
            err -= dist.y;
            if (err < 0) {
                y += stepY;
                err += dist.x;
            }
        }
        if (reverseFlag) pointArr.reverse();

        return pointArr;
    }
}

export function decodeKey(str){
    let config = {
        alt: false,
        ctrl: false,
        keyCode: null
    }

    str.split('+').forEach(param => {
        if(param === 'CTRL'){
            config.ctrl = true;
        }else if(param === 'ALT'){
            config.alt = true;
        }else{
            config.keyCode = parseInt(keyCode);
        }
    })

    return config
}

export function stringifyKeyEvent(ev){
    let out = '';
    if(ev.altKey){
        out += 'ALT+'
    }
    if(ev.ctrlKey){
        out += 'CTRL+'
    }
    return out + ev.keyCode
}

export function visible(x, y){
    if(x < 0 || x > boardWidth || y < 0 || y > boardHeight) return false;
    return true;
}

export function calculateColumnSize(){
    const columns = $('.column', globals.elements.topMenuContent);
    const windowWidth = window.innerWidth;

    const colWidth = windowWidth / columns.length;

    console.log('calculated wid: ' + colWidth, $('.column', globals.elements.topMenuContent));
    $('.column', globals.elements.topMenuContent).css('width', colWidth);
}