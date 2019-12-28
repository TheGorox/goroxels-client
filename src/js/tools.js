import Tool from './Tool'
import globals from './globals'
import {
    shapes
} from './utils'
import {
    boardWidth,
    boardHeight
} from './config'
import player from './player'

import clickerIcon from '../img/toolIcons/clicker.png'
import moveIcon from '../img/toolIcons/move.png'

const clicker = new Tool('clicker', clickerIcon);
const clickerFunc = {
    down: function (e) {
        this.mousedown = true;
        this.lastPos = [player.x, player.y];
    },
    up: function (e) {
        this.mousedown = false;
        this.lastPos = null;
    },
    tick: function(e) {
        if (!this.mousedown || !this.lastPos || player.color === -1) return;
    
        let [x, y] = [player.x, player.y];
        if(this.lastPos[0] === x && this.lastPos[1] === y) return;

        let pixels = shapes.line(this.lastPos[0], this.lastPos[1], x, y);
        
        pixels.forEach(([x, y]) => {
            globals.socket.sendPixel(x, y, player.color)
        });

        this.lastPos = [x, y];
    }    
}
clicker.on('down', clickerFunc.down.bind(clicker));
clicker.on('tick', clickerFunc.tick.bind(clicker));
clicker.on('up', clickerFunc.up.bind(clicker));

export default [
    clicker
]