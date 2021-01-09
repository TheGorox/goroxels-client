import Tool from './Tool'
import globals from './globals'

import shapes from './utils/shapes';
import {
    inBounds
} from './utils/camera';
import {
    boardToScreenSpace,
    screenToBoardSpace
} from './utils/conversions';

import player from './player'
import {
    FX
} from './fxcanvas'
import {
    boardHeight,
    boardWidth,
    hexPalette
} from './config'
import camera from './camera'
import {
    chatInput
} from './elements'
import {
    placePixel,
    toggleChat,
    toggleTopMenu,
    toggleEverything
} from './actions'
import { ROLE } from './constants';

import clickerIcon from '../img/toolIcons/clicker.png'
import moveIcon from '../img/toolIcons/move.png'
import floodfillIcon from '../img/toolIcons/floodfill.png'
import pipetteIcon from '../img/toolIcons/pipette.png'
import template from './template';
import me from './me';

const mobile = globals.mobile;

function getPixel(x, y) {
    return globals.chunkManager.getChunkPixel(x, y)
}

function getProtect(x, y) {
    return globals.chunkManager.getProtect(x, y)
}

function isOdd(x, y) {
    return ((x + y) % 2) === 0
}

function getCurCol() {
    if (player.secondCol === -1) {
        return ~player.color ? player.color : -1;
    }
    if (player.color === -1) return player.secondCol;

    return isOdd(player.x, player.y) ? player.color : player.secondCol
}

function getColByCord(x, y, first = player.color, second = player.secondCol) {
    if (second === -1) return first;
    if (first === -1) return second;

    return isOdd(x, y) ? first : second
}

function render() {
    globals.renderer.needRender = true;
}

function renderFX() {
    globals.fxRenderer.needRender = true;
}

function protectPixels(pixels) {
    globals.socket.sendPixels(pixels, true);
}

class Clicker extends Tool {
    constructor(...args) {
        super(...args);

        this._pendingPixels = {};

        this.on('down', this.down);
        this.on('up', this.up);
        this.on('move', this.move);
        this.on('leave', this.up);

        setInterval(() => {
            this.clearPending() &&
                renderFX();
        }, 1000);

        this.fx = new FX(this.render.bind(this));
        // костыль
        // setTimeout(() => globals.fxRenderer.add(this.fx));
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
        if (!this.mousedown || e.gesture || getCurCol() === -1) return;

        let [x, y] = [player.x, player.y];

        let pixels = shapes.line(this.lastPos[0], this.lastPos[1], x, y);
        this.lastPos = [x, y];

        for (let [x, y] of pixels) { // TODO reduce code size here
            if (player.brushSize === 1) {
                const key = `${x},${y}`;
                const color = getColByCord(x, y);

                if (getPixel(x, y) === color) continue;

                const pixel = getPixel(x, y),
                isProtected = getProtect(x, y);
                if (pixel === color || pixel === -1 || (isProtected && me.role < ROLE.MOD)) continue;

                if (this._pendingPixels[key] && this._pendingPixels[key][0] === color) continue;

                if (!player.bucket.spend(1)) {
                    return
                }

                this._pendingPixels[key] = [color, Date.now()];

                placePixel(x, y, color)
            } else {
                let circle = globals.renderer.preRendered.brush.circle,
                    pixels = [];

                if (player.bucket.allowance < circle.length) {
                    return
                }

                circle.forEach(([cx, cy]) => {
                    let _x = x + cx;
                    let _y = y + cy;

                    const key = `${_x},${_y}`;
                    const myColor = getColByCord(_x, _y);

                    const pixel = getPixel(_x, _y),
                        isProtected = getProtect(_x, _y);
                    if (pixel === myColor || pixel === -1 || (isProtected && me.role < ROLE.MOD)) return;

                    if (this._pendingPixels[key] && this._pendingPixels[key][0] === myColor) return;
                    this._pendingPixels[key] = [myColor, Date.now()];

                    pixels.push([_x, _y, myColor]);
                })

                if (pixels.length === 0) continue;

                player.bucket.spend(pixels.length)

                globals.socket.sendPixels(pixels, false);
            }
        }
    }

    render(ctx) {
        const zoom = camera.zoom;
        ctx.lineWidth = zoom / 5;
        ctx.globalAlpha = .5;

        for (let key of Object.keys(this._pendingPixels)) {
            let [x, y] = key.split(',').map(x => parseInt(x, 10));

            const color = this._pendingPixels[key][0];
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = hexPalette[color];

            const [scrX, scrY] = boardToScreenSpace(x, y);


            ctx.strokeRect(scrX, scrY, zoom, zoom);

            //renderFX();
        }

        ctx.globalAlpha = 1;

        return 1
    }

    clearPending() {
        let deletedSome = false;
        Object.keys(this._pendingPixels).forEach(key => {
            let timestamp = this._pendingPixels[key][1];

            if (Date.now() - timestamp > 2000) {
                delete this._pendingPixels[key];
                deletedSome = true;
            }
        })

        return deletedSome;
    }
}
const clicker = new Clicker('clicker', 32, clickerIcon);

class Protector extends Tool {
    constructor(...args) {
        super(...args);

        this.on('down', this.down);
        this.on('up', this.up);
        this.on('move', this.move);
        this.on('leave', this.up);

        this._pendingPixels = {};

        setInterval(() => {
            this.clearPending()
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
        if (!this.mousedown || e.gesture) return;

        const protect = e.__alt ? 0 : 1;

        let [x, y] = [player.x, player.y];

        let pixels = shapes.line(this.lastPos[0], this.lastPos[1], x, y);
        this.lastPos = [x, y];

        for (let [x, y] of pixels) {
            if (player.brushSize == 1) {
                if(!inBounds(x, y)) continue;

                const key = `${x},${y}`;

                if (this._pendingPixels[key]) continue;
                this._pendingPixels[key] = Date.now();

                protectPixels([[x, y, protect]]);
            } else {
                let circle = globals.renderer.preRendered.brush.circle,
                    pixels = [];

                if (player.bucket.allowance < circle.length) {
                    return
                }

                circle.forEach(([cx, cy]) => {
                    let _x = x + cx;
                    let _y = y + cy;

                    if(!inBounds(_x, _y)) return;

                    const key = `${_x},${_y}`;

                    const isProtected = getProtect(_x, _y);
                    if ((isProtected && protect) || (!isProtected && !protect)) return;

                    if (this._pendingPixels[key]) return;
                    this._pendingPixels[key] = Date.now();

                    pixels.push([_x, _y, protect]);
                })

                if (pixels.length === 0) continue;

                protectPixels(pixels);
            }
        }
    }

    clearPending() {
        let deletedSome = false;
        Object.keys(this._pendingPixels).forEach(key => {
            let timestamp = this._pendingPixels[key];

            if (Date.now() - timestamp > 2000) {
                delete this._pendingPixels[key];
                deletedSome = true;
            }
        })

        return deletedSome;
    }
}
const protector = new Protector('protector', 'V'.charCodeAt(), clickerIcon);

const altProtector = new Protector('alt protector', 'ALT+' + 'V'.charCodeAt(), clickerIcon);
altProtector.off('down', altProtector.down);
altProtector.on('down', (e) => {
    e.__alt = true;
    altProtector.down.call(altProtector, e)
});
altProtector.off('up', altProtector.up);
altProtector.on('up', (e) => {
    e.__alt = true;
    altProtector.up.call(altProtector, e)
});
altProtector.off('move', altProtector.move);
altProtector.on('move', (e) => {
    e.__alt = true;
    altProtector.move.call(altProtector, e)
});

class Mover extends Tool {
    constructor(...args) {
        super(...args);

        this.on('down', this.down);
        this.on('up', this.up);
        this.on('move', this.move);
        this.on('leave', this.up);

        this.downPos = [0, 0];
        this.lastPos = [0, 0];

        this.lastPlayerPos = [0, 0];

        if (!mobile) {
            this.fx = new FX(this.renderCursor);
            // костыль
            setTimeout(() => globals.fxRenderer.add(this.fx));
        }
    }

    renderCursor(ctx) {
        const zoom = camera.zoom;

        const color = getCurCol();

        if (~color && zoom > 1) {
            if (player.brushSize == 1) {
                const [x, y] = boardToScreenSpace(player.x, player.y);
                ctx.strokeStyle = hexPalette[color];
                //ctx.fillStyle = hexPalette[player.color];
                ctx.lineWidth = zoom / 5;


                //ctx.fillRect(x, y, zoom, zoom);
                ctx.strokeRect(x, y, zoom, zoom);

                //renderFX();
            } else {
                const [x, y] = boardToScreenSpace(player.x - player.brushSize / 2, player.y - player.brushSize / 2);
                ctx.drawImage(globals.renderer.preRendered.brush.canvas, x, y)
            }
        }

        return 1
    }

    down(e) {
        if (e.ctrlKey) return;

        this.mousedown = true;

        if (!mobile) {
            this.downPos = this.lastPos = [e.clientX, e.clientY]
        }
    }
    up(e) {
        if (e.ctrlKey) return;

        this.mousedown = false;

        if (!mobile && this.moveThresold() && e.type !== 'mouseleave') {
            // right/middle/anything
            if (e instanceof MouseEvent && e.button != 0) return;

            clicker.down(); // lol yes
            clicker.up();
        }
    }

    move(e) {
        if (e.ctrlKey) return;

        if (!mobile) {
            if (this.lastPlayerPos[0] != player.x ||
                this.lastPlayerPos[1] != player.y ||
                this.mousedown) {
                renderFX();
            }

            this.lastPlayerPos = [player.x, player.y];
        }

        if (!this.mousedown) return;

        if (!mobile) {
            this.lastPos = [e.clientX, e.clientY]

            if (this.moveThresold())
                return
        }

        camera.moveTo(-e.movementX / camera.zoom / devicePixelRatio, -e.movementY / camera.zoom / devicePixelRatio);
    }

    moveThresold() {
        return (Math.abs(this.downPos[0] - this.lastPos[0]) < 5 &&
            Math.abs(this.downPos[1] - this.lastPos[1]) < 5)
    }
}
const mover = new Mover('mover', null, moveIcon);

class FloodFill extends Tool {
    constructor(...args) {
        super(...args);

        this.on('up', this.up);
        this.on('down', this.down);
        this.on('leave', this.up);

        this.on('tick', this.tick);

        this.previewing = false;
        this.fx = null;
        this.prevStack = [];
    }

    up(e) {
        if (this.previewing) {
            this.fx.remove();
        } else return; // means that key wasn't pressed

        this.previewing = false;

        if (this.active) { // stop and return
            this.active = false;
            return
        }

        const cord = screenToBoardSpace(e.clientX, e.clientY);
        if (player.color === -1 || !inBounds(...cord) || e.type === 'mouseleave') {
            return
        }

        this.active = true;

        this.stack = [
            [player.x, player.y]
        ];

        this.playerCol = player.color;
        this.secondPlayerCol = player.secondCol;
        this.fillingCol = getPixel(player.x, player.y);
    }

    down(e) {
        // preview floodfill
        if (e.repeat || this.previewing) {
            return
        }

        const cord = screenToBoardSpace(e.clientX, e.clientY);
        if (player.color === -1 || !inBounds(...cord)) {
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

            this.playerCol = player.color;
            this.secondPlayerCol = player.secondCol;
            this.fillingCol = getPixel(player.x, player.y);
        }

        function paint() {
            if (!this.prevStack.length) return 1;

            let [x, y] = this.prevStack.pop();

            let color = getColByCord(x, y, this.playerCol, this.secondPlayerCol);
            let tileCol = getPixel(x, y);
            let painted = this.showedPixels.indexOf(x + ',' + y) !== -1;

            if (painted || tileCol === color || tileCol !== this.fillingCol || !inBounds(x, y)) {
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
                restart.call(this);
            }

            let res = 0;
            for (let i = 0; i < 100 && res == 0; i++)
                res = paint.call(this);


            ctx.strokeWidth = camera.zoom;
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

            this.showedPixels.forEach((p, i) => {
                let [x, y] = p.split(',').map(x => parseInt(x, 10));

                let alpha = 1;
                let len = this.showedPixels.length
                if (len >= 100 && i < len / 2) {
                    alpha = 1 - (((len / 2) - i) / (len / 2))
                    if (alpha <= 0) return;
                }
                ctx.globalAlpha = alpha;

                const color = getColByCord(x, y, this.playerCol, this.secondPlayerCol);
                ctx.strokeStyle = hexPalette[color];

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
        for (let i = 0; i < 15 && this.stack.length; i++) {
            if (!player.bucket.spend(1)) break;

            let [x, y] = this.stack.pop();

            let color = getColByCord(x, y, this.playerCol, this.secondPlayerCol);
            let tileCol = getPixel(x, y);

            if (tileCol === color || tileCol !== this.fillingCol || !inBounds(x, y)) {
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

            placePixel(x, y, color);
        }

        if (!this.stack.length) return this.active = false;
    }

    check(x, y) {
        if (getPixel(x, y) !== this.fillingCol) return false;
        this.stack.unshift([x, y]);
        return true
    }
}
const floodfill = new FloodFill('floodfill', 'F'.charCodeAt(), floodfillIcon);

class Pipette extends Tool {
    constructor(...args) {
        super(...args);

        this.on('down', this.down);
    }

    down(e) {
        const color = getPixel(player.x, player.y);

        if (color === -1) return;

        if (e.__alt)
            player.switchSecondColor(color);
        else
            player.switchColor(color);

        renderFX();
    }
}
const pipette = new Pipette('pipette', 'C'.charCodeAt(), pipetteIcon);

const altPipette = new Pipette('alt pipette', 'ALT+' + 'C'.charCodeAt(), pipetteIcon);
altPipette.off('down', altPipette.down);
altPipette.on('down', (e) => {
    e.__alt = true;
    altPipette.down.call(altPipette, e)
});

class Line extends Tool {
    constructor(...args) {
        super(...args);

        this.handlers();
    }

    handlers() {
        let startCoords, endCoords, lastCoords = [],
            fx, isDown = false,
            line,
            startColor1, startColor2;

        function down() {
            if (isDown) return;
            isDown = true;

            startCoords = [player.x, player.y];

            [startColor1, startColor2] = [player.color, player.secondCol];

            this.off('tick', tick);
            this.emit('move');
        }

        function move() {
            if (!isDown || !startCoords) return;

            endCoords = [player.x, player.y];

            if (endCoords[0] != lastCoords[0] || endCoords[1] != lastCoords[1]) {
                lastCoords = endCoords;

                const line = shapes.line(...startCoords, ...endCoords)

                fx && fx.remove();

                fx = new FX((ctx) => {
                    ctx.globalAlpha = .5;
                    line.forEach(([x, y]) => {
                        const color = getColByCord(x, y);
                        ctx.fillStyle = hexPalette[color];

                        let [screenX, screenY] = boardToScreenSpace(x, y);
                        ctx.fillRect(screenX, screenY, camera.zoom, camera.zoom);
                    });

                    ctx.strokeStyle = '#000000';
                    ctx.strokeWidth = camera.zoom / 5;

                    const startScreen = boardToScreenSpace(...line[0]);
                    const endScreen = boardToScreenSpace(...line[line.length - 1]);

                    ctx.beginPath();
                    ctx.moveTo(...startScreen.map(z => z += camera.zoom / 2));
                    ctx.lineTo(...endScreen.map(z => z += camera.zoom / 2));
                    ctx.closePath();

                    ctx.stroke();

                    ctx.globalAlpha = 1;

                    return 1
                })
                globals.fxRenderer.add(fx);
            }
        }

        function up() {
            isDown = false;

            if (!startCoords) return;

            fx && fx.remove();

            if (!endCoords) endCoords = [player.x, player.y];

            line = shapes.line(...startCoords, ...endCoords);

            renderFX();
            this.on('tick', tick);
        }

        function tick() {
            while (true) {
                if (!line || !line.length) {
                    this.off('tick', tick);
                    return;
                }

                if (!player.bucket.spend(1)) return;

                const [x, y] = line.pop();
                const col = getColByCord(x, y, startColor1, startColor2);

                if (col === undefined || col === -1) return this.off('tick', tick);
                if (getPixel(x, y) === col) continue;

                placePixel(x, y, col);
                return
            }
        }

        down = down.bind(this);
        move = move.bind(this);
        up = up.bind(this);

        tick = tick.bind(this);

        this.on('down', down);
        this.on('move', move);
        this.on('up', up);
    }
}
const line = new Line('line', 16 /*Shift*/, floodfillIcon);

const cordAdd = new Tool('coords to chat', 'U'.charCodeAt());
cordAdd.on('up', function () {
    chatInput[0].value += this.elements.coords.text() + ' ';
    chatInput.trigger('focus');
});

const pixelInfo = new Tool('pixel info', 'I'.charCodeAt());
pixelInfo.on('down', function () {
    // TODO
});

const colorSwap = new Tool('swap colors', 'X'.charCodeAt());
colorSwap.on('down', function () {
    if (!~player.secondCol && !~player.color) {
        player.swapColors();
    }
});

const colorDec = new Tool('left color', 'A'.charCodeAt());
colorDec.on('down', function () {
    let color = player.color;
    if (--color < 0) color = hexPalette.length - 1;

    player.switchColor(color);
});

const colorInc = new Tool('right color', 'S'.charCodeAt());
colorInc.on('down', function () {
    let color = player.color;
    if (++color >= hexPalette.length) color = 0;

    player.switchColor(color);
});

const chatOpac = new Tool('0/1 chat', 'K'.charCodeAt());
chatOpac.on('down', function () {
    toggleChat();
});

const menuOpac = new Tool('0/1 top menu', 'L'.charCodeAt());
menuOpac.on('down', function () {
    toggleTopMenu();
});

const allOpac = new Tool('0/1 all except board', 186 /* ; */);
allOpac.on('down', function () {
    toggleEverything();
});

class CtrlZ extends Tool {
    constructor(...args) {
        super(...args);

        this.handlers();
    }

    handlers() {
        let isDown = false;

        const down = function () {
            // i know about e.repeat
            if (isDown) return;
            isDown = true;

            console.log('down')
            this.on('tick', tick);
        }.bind(this);

        const up = function () {
            isDown = false;

            console.log('up')
            this.off('tick', tick);
            tickNow = tickMax;
            lastTick = 0;
        }.bind(this);

        const tickMax = 500;
        const tickMin = 50;
        const step = 1.3;
        let tickNow = tickMax;

        let lastTick = 0;
        const tick = function () {
            const ts = Date.now() - lastTick;
            if (ts < tickNow) return;
            lastTick = Date.now();
            tickNow /= step;
            if (tickNow < tickMin) tickNow = tickMin;

            if (player.placed.length > player.maxPlaced) {
                player.placed = player.placed.slice(-player.maxPlaced);
            }
            if (!player.placed.length) return;
            if (!player.bucket.spend(1)) return;

            const [x, y, c] = player.placed.pop();

            placePixel(x, y, c, false);
        }.bind(this);

        this.on('down', down);
        this.on('up', up);
    }
}
const ctrlZ = new CtrlZ('ctrlZ', 'CTRL+' + 'Z'.charCodeAt());

export default {
    clicker,
    mover,
    floodfill,
    pipette,
    altPipette,
    line,
    colorInc,
    colorDec,
    chatOpac,
    menuOpac,
    allOpac,
    ctrlZ,
    protector,
    altProtector
}