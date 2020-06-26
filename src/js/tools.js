import Tool from './Tool'
import globals from './globals'
import {
    shapes,
    visible,
    boardToScreenSpace
} from './utils'
import camera from './camera'
import player from './player'
import {
    FX
} from './fxcanvas'
import {
    hexPalette
} from './config'

import clickerIcon from '../img/toolIcons/clicker.png'
import moveIcon from '../img/toolIcons/move.png'
import floodfillIcon from '../img/toolIcons/floodfill.png'
import pipetteIcon from '../img/toolIcons/pipette.png'

const mobile = globals.mobile;

function getPixel(x, y) {
    return globals.chunkManager.getChunkPixel(x, y)
}

function render(){
    globals.renderer.needRender = true;
}

function renderFX(){
    globals.fxRenderer.needRender = true;
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
        this.lastPos = [x, y];

        for (let [x, y] of pixels) {
            const key = `${x},${y}`;
            if (this._pendingPixels[key] && this._pendingPixels[key][0] === color) continue;
            this._pendingPixels[key] = [color, Date.now()];

            if (!player.bucket.spend(1))
                break


            globals.socket.sendPixel(x, y, color);
        }
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

        this.downPos = [0, 0];
        this.lastPos = [0, 0];

        this.fx = new FX(this.renderCursor);
        // костыль
        setTimeout(() => globals.fxRenderer.add(this.fx));
    }

    renderCursor(ctx){
        const zoom = camera.zoom;

        if (player.color != -1 && zoom > 1) {
            renderFX();

            ctx.strokeStyle = hexPalette[player.color];
            //ctx.fillStyle = hexPalette[player.color];
            ctx.lineWidth = zoom/5;

            const [x, y] = boardToScreenSpace(player.x, player.y);

            //ctx.fillRect(x, y, zoom, zoom);
            ctx.strokeRect(x, y, zoom, zoom);
        }
    }

    down(e) {
        this.mousedown = true;

        if (!mobile) {
            this.downPos = this.lastPos = [e.clientX, e.clientY]
        }
    }
    up() {
        this.mousedown = false;

        if (!mobile && this.moveThresold()){
            clicker.down(); // lol yes
            clicker.up();
        }
    }

    move(e) {
        renderFX();

        if (!this.mousedown) return;

        if (!mobile) {
            this.lastPos = [e.clientX, e.clientY]

            if (this.moveThresold())
                return
        }

        camera.moveTo(-e.movementX / camera.zoom / devicePixelRatio, -e.movementY / camera.zoom / devicePixelRatio);
    }

    moveThresold(){
        return (Math.abs(this.downPos[0] - this.lastPos[0]) < 5 &&
        Math.abs(this.downPos[1] - this.lastPos[1]) < 5)
    }
}
const mover = new Mover('mover', moveIcon);

class FloodFill extends Tool {
    constructor(...args) {
        super(...args);

        this.on('up', this.up);
        this.on('down', this.down);
        this.on('tick', this.tick);

        this.previewing = false;
        this.fx = null;
        this.prevStack = [];
    }

    up() {
        if (this.previewing) {
            this.fx.remove();
        }
        this.previewing = false;

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

    down() {
        if (this.previewing) {
            return
        }

        if (player.color === -1 || !visible(player.x, player.y)) {
            return
        }
        let _lastX, _lastY;

        restart.apply(this);

        this.showedPixels = [];
        this.fillingCol = getPixel(player.x, player.y);

        let fx = new FX(tick.bind(this));
        globals.fxRenderer.add(fx);
        this.fx = fx;

        //globals.renderer.needRender = true;

        this.previewing = true;

        function restart() {
            this.prevStack = [
                [player.x, player.y]
            ];
            this.showedPixels = [];

            _lastX = player.x;
            _lastY = player.y;
        }

        function paint() {
            if (!this.prevStack.length) return 1;

            let [x, y] = this.prevStack.pop();

            let color = this.playerCol;
            let tileCol = getPixel(x, y);
            let painted = this.showedPixels.indexOf(x + ',' + y) !== -1;

            if (painted || tileCol === color || tileCol !== this.fillingCol || !visible(x, y)) {
                return 0
            }

            this.showedPixels.push(x + ',' + y);

            let top = this.checkP(x, y - 1);
            let bottom = this.checkP(x, y + 1);
            let left = this.checkP(x - 1, y);
            let right = this.checkP(x + 1, y);
            if (top && left) {
                this.checkP(x - 1, y - 1);
            }
            if (top && right) {
                this.checkP(x + 1, y - 1);
            }
            if (bottom && left) {
                this.checkP(x - 1, y + 1);
            }
            if (bottom && right) {
                this.checkP(x + 1, y + 1);
            }

            return 0
        }

        function tick(ctx) {
            if (player.x != _lastX || player.y != _lastY) {
                restart.apply(this);
            }

            let res = 0;
            for (let i = 0; i < 100 && res == 0; i++)
                res = paint.apply(this);


            ctx.strokeStyle = hexPalette[player.color];
            ctx.strokeWidth = camera.zoom;

            this.showedPixels.forEach((p, i) => {
                let [x, y] = p.split(',');

                let alpha = 1;
                let len = this.showedPixels.length
                if (len >= 100 && i < len / 2) {
                    alpha = 1 - (((len / 2) - i) / (len / 2))
                    if (alpha <= 0) return;
                }
                ctx.globalAlpha = alpha;

                let [absX, absY] = boardToScreenSpace(x, y);
                ctx.strokeRect(absX, absY, camera.zoom, camera.zoom);
            });

            return res
        }
    }

    checkP(x, y) {
        if (getPixel(x, y) !== this.fillingCol) return false;
        this.prevStack.unshift([x, y]);
        return true
    }

    tick() {
        if (!this.active) return;

        // TODO
        for (let i = 0; i < 8 && this.stack.length; i++) {
            if (!player.bucket.spend(1)) break;

            let [x, y] = this.stack.pop();

            let color = this.playerCol;
            let tileCol = getPixel(x, y);

            if (tileCol === color || tileCol !== this.fillingCol || !visible(x, y)) {
                continue
            }

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

            globals.socket.sendPixel(x, y, color);
            globals.chunkManager.setChunkPixel(x, y, color);
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

class Pipette extends Tool {
    constructor(...args) {
        super(...args);

        this.on('down', this.down);
    }

    down() {
        const color = getPixel(player.x, player.y);

        if(color === -1) return;

        player.color = color;
        renderFX();
    }
}
const pipette = new Pipette('pipette', pipetteIcon, 'C'.charCodeAt());

export default {
    clicker,
    mover,
    floodfill,
    pipette
}