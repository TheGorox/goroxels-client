import Tool from './Tool'
import globals from './globals'
import {
    shapes,
    visible
} from './utils'
import camera from './camera'
import player from './player'

import clickerIcon from '../img/toolIcons/clicker.png'
import moveIcon from '../img/toolIcons/move.png'
import floodfillIcon from '../img/toolIcons/floodfill.png'

function getPixel(x, y) {
    return globals.chunkManager.getChunkPixel(x, y)
}

class Clicker extends Tool {
    constructor(...args) {
        super(...args);

        this._pendingPixels = {};

        this.on('down', this.down);
        this.on('up', this.up);
        this.on('move', this.move);

        setInterval(() => {
            this.clearPending();
        }, 1000);
    }

    down() {
        if (this.mousedown) return;

        this.mousedown = true;
        this.lastPos = [player.x, player.y];

        this.emit('move', {});
    }
    up() {
        this.mousedown = false;
        this.lastPos = null;
    }

    move(e) {
        if (!this.mousedown || player.color === -1 || e.gesture) return;

        let [x, y] = [player.x, player.y];
        const color = player.color;

        let pixels = shapes.line(this.lastPos[0], this.lastPos[1], x, y);

        // TODO replace with for..of when cooldown
        pixels.forEach(([x, y]) => {
            const key = `${x},${y}`;
            if (this._pendingPixels[key] && this._pendingPixels[key][0] === color) return;
            this._pendingPixels[key] = [color, Date.now()];

            globals.socket.sendPixel(x, y, color)
        });

        this.lastPos = [x, y];
    }

    clearPending() {
        Object.keys(this._pendingPixels).forEach(key => {
            let [_, timestamp] = this._pendingPixels[key];

            if (Date.now() - timestamp > 3000) {
                delete this._pendingPixels[key];
            }
        })
    }
}
const clicker = new Clicker('clicker', clickerIcon, 32);

class Mover extends Tool {
    constructor(...args) {
        super(...args);

        this.on('down', this.down);
        this.on('up', this.up);
        this.on('move', this.move);
    }

    down() {
        this.mousedown = true;
    }
    up() {
        this.mousedown = false;
    }

    move(e) {
        if (!this.mousedown) return;

        camera.moveTo(-e.movementX / camera.zoom / devicePixelRatio, -e.movementY / camera.zoom / devicePixelRatio)
    }
}
const mover = new Tool('mover', moveIcon);

class FloodFill extends Tool {
    constructor(...args) {
        super(...args);

        this.on('up', this.up);
        this.on('tick', this.tick);
    }

    up() {
        if (this.active) { // stop and return
            this.active = false;
            return
        }
        if (player.color === -1 || !visible(player.x, player.y)) {
            return
        }

        this.active = true;

        this.stack = [
            [player.x, player.y]
        ];

        this.playerCol = player.color;
        this.fillingCol = getPixel(player.x, player.y);
    }

    tick() {
        if (!this.active) return;

        // TODO
        for (var painted = 0; painted < 9*3 && this.stack.length; painted++) {
            let [x, y] = this.stack.pop();

            let color = this.playerCol;
            let tileCol = getPixel(x, y);

            if (tileCol === color || tileCol !== this.fillingCol || !visible(x, y)) {
                continue
            }

            globals.socket.sendPixel(x, y, color);

            //this.stack.push([x, y]);

            let top = this.check(x, y - 1);
            let bottom = this.check(x, y + 1);
            let left = this.check(x - 1, y);
            let right = this.check(x + 1, y);
            if (top && left) {
                this.check(x - 1, y - 1);
            }
            if (top && right) {
                this.check(x + 1, y - 1);
            }
            if (bottom && left) {
                this.check(x - 1, y + 1);
            }
            if (bottom && right) {
                this.check(x + 1, y + 1);
            }
        }

        if (!this.stack.length) return this.active = false;
    }

    check(x, y) {
        if (getPixel(x, y) !== this.fillingCol) return false;
        this.stack.unshift([x, y]);
        return true
    }
}
const floodfill = new FloodFill('floodfill', floodfillIcon, 'F'.charCodeAt());

export default {
    clicker,
    mover,
    floodfill
}