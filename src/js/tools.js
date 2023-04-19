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
    canvasId,
    chunkSize,
    hexPalette,
    palette
} from './config'
import camera from './camera'
import {
    chatInput
} from './elements'
import {
    placePixel,
    toggleChat,
    toggleTopMenu,
    toggleEverything,
    placePixels,
    updateTemplate,
    updateBrush,
    showProtected,
    changeSelector,
    apiRequest
} from './actions'
import { ROLE } from './constants';

import clickerIcon from '../img/toolIcons/clicker.png'
import moveIcon from '../img/toolIcons/move.png'
import floodfillIcon from '../img/toolIcons/floodfill.png'
// import pipetteIcon from '../img/toolIcons/pipette.png'
import lineIcon from '../img/toolIcons/line.png'
import protectIcon from '../img/toolIcons/protect.png'
import revertIcon from '../img/toolIcons/revert.png'

import template from './template';
import me from './me';
import { closestColor } from './utils/color';
import { getOrDefault, setLS } from './utils/localStorage';
import { htmlspecialchars, testPointInPolygon } from './utils/misc';

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

function checkBounds(x, y) {
    return (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight)
}

let tmLoaded = false;
let onTMID = setInterval(() => {
    if (globals.toolManager) {
        clearInterval(onTMID);
        _onTmLoaded();
    }
}, 5);
let tmCallbacks = [];
function _onTmLoaded() {
    tmLoaded = true;
    tmCallbacks.forEach(cb => cb(globals.toolManager));
    tmCallbacks = [];
}
function onToolManager(cb) {
    if (tmLoaded) cb(globals.toolManager);
    else tmCallbacks.push(cb)
}

// fxRenderer is loaded later then tools
// so here is workaround
let _deferredFX = [];
function addFX(fx, layer) {
    if (globals.fxRenderer) {
        globals.fxRenderer.add(fx, layer);
    } else _deferredFX.push([fx, layer]);
}

function removeFX(fx) {
    globals.fxRenderer.remove(fx);
}

let fxi = setInterval(() => {
    if (globals.fxRenderer) {
        clearInterval(fxi);
        for (let [fx, layer] of _deferredFX) {
            addFX(fx, layer);
        }
        _deferredFX = [];
    }
}, 5);

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
        this.minZoom = 2;

        this.on('down', this.down)
        this.on('up', this.up)
        this.on('move', this.move)
        this.on('leave', this.up)
        this.on('_gesture', this.ongesture);

        onToolManager(() => {
            // mobile is already subscribed to pointer events
            // so this will duplicate them
            if (!mobile) {
                globals.eventManager.on('mousedown', this.mousedown.bind(this));
                globals.eventManager.on('mouseup', this.mouseup.bind(this));
            }
        })

        this.clrInterval = setInterval(() => {
            if (this.clearPending())
                renderFX();
        }, 250);

        // pending pixels debug visualizer
        this.fx = new FX(this.render.bind(this));
        //addFX(this.fx);
    }

    // mouse zone
    mousedown(e) {
        if (e.button !== 0) return;
        this.screenPos = [e.clientX, e.clientY];
    }
    mouseup(e) {
        if (e.button !== 0 || !this.screenPos) return;
        const dx = Math.abs(e.clientX - this.screenPos[0]);
        const dy = Math.abs(e.clientY - this.screenPos[1]);
        if (dx > 5 || dy > 5) return;

        const [x, y] = [player.x, player.y];
        const color = getColByCord(x, y);
        if (this.checkPixel(x, y) && ~color)
            placePixel(player.x, player.y, getColByCord(x, y));
    }
    // end of mouse zone

    down(e) {
        this.lastPos = [player.x, player.y];
        this.screenPos = [e.clientX, e.clientY];

        if (this.mouseIsDown || camera.zoom < this.minZoom) return;

        this.mouseIsDown = true;

        if (!mobile)
            this.emit('move', {});
        else {
            this.pointerId = e.pointerId;
        }
    }
    up(e) {
        if (this.mouseIsDown) {
            if (mobile)
                this.emit('move', e, true);
            this.mouseIsDown = false;
        }
    }

    ongesture() {
        this.mouseIsDown = false;
        this.lastPos = null;
    }

    checkPixel(x, y) {
        const key = `${x},${y}`;
        const myColor = getColByCord(x, y);

        const pixel = getPixel(x, y),
            isProtected = getProtect(x, y);
        if (pixel === myColor || pixel === -1 || (isProtected && me.role < ROLE.MOD)) return;

        if (this._pendingPixels[key] && this._pendingPixels[key][0] === myColor) return;
        this._pendingPixels[key] = [myColor, Date.now()];

        return true
    }

    /*
    */
    move(e, isUp = false) {
        if (e.gesture) {
            // if gesture is started, we reset mousedown state
            this.ongesture();
            return
        }
        if (!this.mouseIsDown ||
            e.gesture ||
            getCurCol() === -1) return;

        // mobile and same pointerid as at down but also not initiated by 'up' event
        if (mobile && this.pointerId !== e.pointerId)
            return

        const screenX = e.clientX,
            screenY = e.clientY;

        const dx = Math.abs(screenX - this.screenPos[0]);
        const dy = Math.abs(screenY - this.screenPos[1]);

        if (dx < 5 && dy < 5 && !isUp) {
            return;
        }

        let [x, y] = [player.x, player.y];

        let line = shapes.line(this.lastPos[0], this.lastPos[1], x, y);
        this.lastPos = [x, y];

        let circle = [[0, 0]];
        if (player.brushSize !== 1) {
            circle = globals.renderer.preRendered.brush.circle;
        }

        for (let [x, y] of line) {
            let pixels = [];

            if (!this.checkAllowance(circle.length)) return;
            circle.forEach(([cx, cy]) => {
                let _x = x + cx;
                let _y = y + cy;
                if (this.checkPixel(_x, _y)) {
                    const myColor = getColByCord(_x, _y); // duplicate
                    pixels.push([_x, _y, myColor]);
                }
            })

            this.place(pixels);
        }
    }

    checkAllowance(count) {
        if (player.bucket.allowance < count) {
            return false
        }
        return true
    }

    place(pixels) {
        if (pixels.length === 0) return;

        player.bucket.spend(pixels.length)

        if (pixels.length == 1) {
            placePixel(...pixels[0])
        } else
            placePixels(pixels);
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
        }

        ctx.globalAlpha = 1;

        return 1
    }

    clearPending() {
        let deletedSome = false;
        Object.keys(this._pendingPixels).forEach(key => {
            let timestamp = this._pendingPixels[key][1];

            if (Date.now() - timestamp > 500) {
                delete this._pendingPixels[key];
                deletedSome = true;
            }
        })

        return deletedSome;
    }
}
const clicker = new Clicker('clicker', 'Space', clickerIcon);

class Protector extends Clicker {
    constructor(...args) {
        super(...args);

        this.minZoom = 1;

        // is this unprotector
        this._alt = false;
        // first touch determines whether protect or not (for full down-move-up):
        // protected => unprotect; unprotected => protect,
        // i.e. inverts pixel state
        this._mobileIsProtect = null;
    }

    getProtectState() {
        if (mobile)
            return this._mobileIsProtect;
        else
            return this._alt ? false : true;

    }

    // override Clicker's mouse events
    mousedown() { }
    mouseup() { }

    down(e) {
        if (this.mouseIsDown) return;

        super.down(e);

        showProtected(); // force protect visibility
        this._mobileIsProtect = !getProtect(...this.lastPos);
    }

    checkPixel(x, y) {
        const key = `${x},${y}`;
        const state = this.getProtectState();

        const curState = getProtect(x, y);
        if (curState === state) return;

        if (this._pendingPixels[key] && this._pendingPixels[key][0] === state) return;
        this._pendingPixels[key] = [state, Date.now()];

        return true
    }

    checkAllowance() { return true }

    place(pixels) {
        // now we should replace colors from
        // clicker's move func with protect state
        const state = this.getProtectState();
        pixels.forEach(p => p[2] = state);
        if (!pixels.length) return;

        protectPixels(pixels);
    }

    render() { }
}
const protector = new Protector('protector', 'KeyV', protectIcon, ROLE.MOD);

const altProtector = new Protector('alt protector', 'ALT+KeyV', null, ROLE.MOD);
altProtector._alt = true;

class Mover extends Tool {
    constructor(...args) {
        super(...args);

        this.handlers();

        this.downPos = [0, 0];
        this.lastPos = [0, 0];

        this.lastPlayerPos = [0, 0];

        if (!mobile) {
            this.fx = new FX(this.renderCursor);

            addFX(this.fx);
        }
    }

    handlers() {
        // костыль
        onToolManager(() => {
            this.on('down', this.down);
            this.on('up', this.up);
            // bind to toolManager for handling not only on canvas
            globals.toolManager.on('move', this.move.bind(this));
            this.on('leave', this.up);
        })
    }

    renderCursor(ctx) {
        const zoom = camera.zoom;

        const color = getCurCol();

        if (~color && zoom > 1) {
            if (player.brushSize == 1) {
                let [x, y] = boardToScreenSpace(player.x, player.y);
                ctx.strokeStyle = hexPalette[color];
                //ctx.fillStyle = hexPalette[player.color];
                ctx.lineWidth = zoom / 5;

                let w, h;
                let halfLineWid = ctx.lineWidth / 2;

                x += halfLineWid;
                y += halfLineWid;

                w = zoom - ctx.lineWidth;
                h = w;

                //ctx.fillRect(x, y, zoom, zoom);
                ctx.strokeRect(x, y, w + 1, h + 1);

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

        // little workaround to keep any ui text
        // unselected while canvas moves
        // guess it's uneffictive
        changeSelector('#ui>div>*', { 'pointer-events': 'none' })

        if (!mobile) {
            this.downPos = this.lastPos = [e.clientX, e.clientY]
        }
    }
    up(e) {
        if (e.ctrlKey) return;

        this.mousedown = false;
        changeSelector('#ui>div>*', { 'pointer-events': 'all' })

        if (!mobile && this.moveThresold() && e.type !== 'mouseleave') {
            // right/middle/anything
            if (e instanceof MouseEvent && e.button != 0) return;
        }
    }

    move(e) {
        // for template mover
        if (e.ctrlKey) return;

        // idk what was purpose of this
        // but i actually need to render fx on mobiles
        // if (!mobile) {
        if (this.lastPlayerPos[0] != player.x ||
            this.lastPlayerPos[1] != player.y ||
            this.mousedown) {
            renderFX();
        }

        this.lastPlayerPos = [player.x, player.y];
        // }

        if (!this.mousedown) return;

        if (!mobile) {
            this.lastPos = [e.clientX, e.clientY]

            if (this.moveThresold())
                return
        }

        // now works without pixel ratio, i'll keep it here if not
        camera.moveTo(-e.movementX / camera.zoom /* / devicePixelRatio */, -e.movementY / camera.zoom /* / devicePixelRatio */);
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

    up(e, isCancel) {
        if (this.active) { // stop and return
            this.active = false;
            return
        }

        if (this.previewing) {
            this.fx.remove();
            renderFX();
            this.previewing = false;
        } else return; // means that key wasn't pressed


        if (isCancel)
            return;

        const cord = screenToBoardSpace(e.clientX, e.clientY);
        if (getColByCord(...cord) === -1 || !inBounds(...cord) || e.type === 'mouseleave') {
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
        if (e.repeat || this.previewing || this.active) {
            return
        }

        const cord = screenToBoardSpace(e.clientX, e.clientY);
        if (getColByCord(...cord) === -1 || !inBounds(...cord)) {
            return
        }
        let _lastX, _lastY;

        restart.apply(this);

        this.showedPixels = [];
        this.fillingCol = getPixel(player.x, player.y);

        let fx = new FX(tick.bind(this));
        addFX(fx, 0);

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
            if (globals.mobile && globals.toolManager.tool !== this) {
                this.up({}, true);
                return 1;
            }
            if (player.x != _lastX || player.y != _lastY) {
                restart.call(this);
            }
            if (getCurCol() === -1) return 1;

            let res = 0;
            for (let i = 0; i < 700 && res == 0; i++)
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
const floodfill = new FloodFill('floodfill', 'KeyF', floodfillIcon);

class Pipette extends Tool {
    constructor(...args) {
        super(...args);

        if (mobile) {
            return
            this.on('down', this.mobileDown.bind(this));
            this.on('up', this.mobileUp.bind(this));
        } else
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

    // separate handlers for handling both
    // primary and seconary colors on mobiles

    // DISABLED FOR THE MOMENT
    // is pipette really need in game
    // with restricted palette .. ?
    mobileDown() {
        this.downCord = [player.x, player.y];
        this.downTime = Date.now();
    }

    mobileUp() {
        let lastCord = [player.x, player.y];
        let lastTime = Date.now();

        this.downCord = null;
        this.downTime = null;
    }
}
const pipette = new Pipette('pipette', 'KeyC', /*pipetteIcon*/);

const altPipette = new Pipette('alt pipette', 'ALT+KeyC');
altPipette.off('down', altPipette.down);
altPipette.on('down', (e) => {
    e.__alt = true;
    altPipette.down.call(altPipette, e)
});

class Line extends Tool {
    constructor(...args) {
        super(...args);

        this.drawLength = JSON.parse(getOrDefault('drawLineLen', false));;

        onToolManager(() => {
            this.handlers();
        })
    }

    handlers() {
        let startCoords, endCoords, lastCoords = [],
            fx, isDown = false,
            line,
            startColor1, startColor2, startCircleSize;

        function down() {
            if (isDown) return;
            isDown = true;

            startCoords = [player.x, player.y];

            [startColor1, startColor2] = [player.color, player.secondCol];

            startCircleSize = 1;
            if (player.brushSize !== 1) {
                startCircleSize = globals.renderer.preRendered.brush.circle.length;
            }

            //this.emit('move');
        }

        function move(e) {
            if (!isDown || !startCoords) return;
            if (e.gesture) {
                isDown = false;
                return startCoords = null;
            };

            endCoords = [player.x, player.y];

            if (player.color === -1 && player.secondCol === -1) {
                fx && removeFX(fx);
                return;
            }
            if (endCoords[0] != lastCoords[0] || endCoords[1] != lastCoords[1]) {
                lastCoords = endCoords;

                const line = buildLine(...startCoords, ...endCoords)

                fx && removeFX(fx);
                fx = new FX((ctx) => {
                    ctx.globalAlpha = .5;

                    // draw line pixel by pixel
                    line.forEach(([x, y]) => {
                        const color = getColByCord(x, y);
                        ctx.fillStyle = hexPalette[color];

                        let [screenX, screenY] = boardToScreenSpace(x, y);
                        ctx.fillRect(screenX, screenY, camera.zoom, camera.zoom);
                    });

                    // draw (non pixelated) black line over the line
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = camera.zoom / 5;

                    const startScreen = boardToScreenSpace(...line[0]);
                    const endScreen = boardToScreenSpace(...line[line.length - 1]);

                    ctx.beginPath();
                    ctx.lineCap = 'round'
                    ctx.moveTo(...startScreen.map(z => z += camera.zoom / 2));
                    ctx.lineTo(...endScreen.map(z => z += camera.zoom / 2));

                    // draw line length text

                    function angle(cx, cy, ex, ey) {
                        var dy = ey - cy;
                        var dx = ex - cx;
                        var theta = Math.atan2(dy, dx); // range (-PI, PI]
                        theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
                        //if (theta < 0) theta = 360 + theta; // range [0, 360)
                        return theta;
                      }

                      function toRadians (angle) {
                        return angle * (Math.PI / 180);
                      }

                    if (this.drawLength && line.length > 1) {
                        let [startPosX, startPosY] = startScreen;
                        let [endPosX, endPosY] = endScreen;

                        let minX = Math.min(startPosX, endPosX);
                        let minY = Math.min(startPosY, endPosY);
                        let maxX = Math.max(startPosX, endPosX);
                        let maxY = Math.max(startPosY, endPosY);

                        let [midPosX, midPosY] = [maxX-Math.abs(maxX-minX)/2, maxY-Math.abs(maxY-minY)/2];

                        // append half-pixel offset to center text in the middle
                        midPosX += camera.zoom * 0.5;
                        midPosY += camera.zoom * 0.5;

                        let lineAngle = angle(startPosX, startPosY, endPosX, endPosY);
                        if(lineAngle > 90){
                            lineAngle -= 180;
                        }else if(lineAngle < -90){
                            lineAngle += 180;
                        }

                        let lineRads = toRadians(lineAngle);
                        let offsetX = 40*Math.sin(lineRads);
                        let offsetY = 40*Math.cos(lineRads);

                        midPosX += offsetX;
                        midPosY -= offsetY;

                        

                        ctx.save();
                        ctx.globalAlpha = .7;

                        const fontHei = 20//camera.zoom / 1.5;
                        ctx.font = fontHei + 'px sans-serif';
                        ctx.fillStyle = 'black'
                        ctx.strokeStyle = 'white';

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.lineWidth = fontHei / 6;

                        const text = line.length;
                        const [x, y] = [midPosX, midPosY];

                        ctx.strokeText(text, x, y);
                        ctx.fillText(text, x, y);

                        ctx.restore();
                    }

                    ctx.stroke();

                    ctx.globalAlpha = 1;

                    return 1
                })
                addFX(fx)
            }
        }

        function buildLine(x1, y1, x2, y2) {
            let circle = [[0, 0]];
            if (player.brushSize !== 1) {
                circle = globals.renderer.preRendered.brush.circle;
            }

            const w = boardWidth;

            // to not repeat already added pixels
            const placed = new Set();

            const bruhLinePixels = [];
            const linePixels = shapes.line(x1, y1, x2, y2);

            // starting from the end and then
            // reversing brushed array will
            // make pixels rendering looking more brush-like
            for (let i = linePixels.length - 1; i >= 0; i--) {
                const [x, y] = linePixels[i]
                circle.forEach(([offX, offY]) => {
                    const absX = x + offX;
                    const absY = y + offY;

                    const encoded = absX + absY * w;

                    if (placed.has(encoded)) return;
                    placed.add((encoded));

                    bruhLinePixels.push([absX, absY]);
                })
            }

            return bruhLinePixels.reverse();
        }

        function up() {
            this.off('tick', tick);

            if (!isDown || !startCoords) return;
            isDown = false;

            fx && fx.remove();

            if (!endCoords) endCoords = [player.x, player.y];

            line = buildLine(...startCoords, ...endCoords);
            startCoords = null;
            endCoords = null;

            renderFX();
            this.on('tick', tick);
        }

        function tick() {
            if (player.color === -1 && player.secondCol === -1) {
                // assume player cancelled line
                line = null;
            }

            let placed = 0;
            while (true) {
                if (!line || !line.length) {
                    this.off('tick', tick);
                    return;
                }

                const [x, y] = line.pop();
                const col = getColByCord(x, y, startColor1, startColor2);

                if (col === undefined || col === -1) return this.off('tick', tick);
                if (!checkBounds(x, y) || getPixel(x, y) === col) continue;

                if (!player.bucket.spend(1)) return line.push([x, y]);

                placePixel(x, y, col);
                placed++;
                if (placed >= startCircleSize / 2) {
                    return
                }
            }
        }

        down = down.bind(this);
        move = move.bind(this);
        up = up.bind(this);

        tick = tick.bind(this);

        this.on('down', down);
        // TODO maybe it's too many listeners
        // so it'd be good to make some sort of local signal
        // that there was gesture (this listener is only for e.gesture to reset start coords)
        globals.toolManager.on('move', move);
        this.on('up', up);
    }
}
const line = new Line('line', 'ShiftLeft', lineIcon);

const cordAdd = new Tool('coords to chat', 'KeyU');
cordAdd.on('up', function () {
    const cords = $('#coords').text();
    if (!cords.length) return;
    chatInput[0].value += cords + ' ';
    chatInput.trigger('focus');
});

const colorSwap = new Tool('swap colors', 'KeyX');
colorSwap.on('up', player.swapColors.bind(player));

const colorDec = new Tool('left color', 'KeyA');
colorDec.on('down', function () {
    let color = player.color;
    if (--color < 0) color = hexPalette.length - 1;

    player.switchColor(color);
});

const colorInc = new Tool('right color', 'KeyS');
colorInc.on('down', function () {
    let color = player.color;
    if (++color >= hexPalette.length) color = 0;

    player.switchColor(color);
});

const chatOpac = new Tool('toggle chat', 'KeyK');
chatOpac.on('down', function () {
    toggleChat();
});

const menuOpac = new Tool('toggle menu', 'KeyL');
menuOpac.on('down', function () {
    toggleTopMenu();
});

const allOpac = new Tool('toggle everything', 'Semicolon' /* ; */);
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

        function reset(){
            isDown = false;

            this.off('tick', tick);
            tickTime = tickMax;
            lastTick = 0;
        }
        reset = reset.bind(this);

        const down = function (e) {
            e.preventDefault();
            e.stopPropagation();
            if(e.gesture){
                return reset();
            }

            // i know about e.repeat
            if (isDown) return;
            isDown = true;

            tick();
            this.on('tick', tick);
        }.bind(this);

        const move = function (e) {
            if(e.gesture){
                reset();
            }
        }.bind(this);

        const up = function () {
            reset();
        }.bind(this);

        const tickMax = 500;
        const tickMin = 50;

        const nocdMinTick = 2;
        // ticknow = ticknow - (ts / nocdStepFactor)
        // i.e ms passed since last tick divided by this factor
        const nocdStepFactor = 100;

        const step = 1.5;
        let tickTime = tickMax;

        let lastTick = 0;
        const tick = function () {
            const ts = Date.now() - lastTick;
            if (ts < tickTime) return;
            let multiTicks = ts / tickTime | 0;
            // when lastTick is 0 (tool is just activated)
            if (multiTicks < 0) multiTicks = 1;

            lastTick = Date.now();

            do {
                // if (tickTime <= tickMin) {
                //     if(player.bucket.delay < tickMin){
                //         tickTime = Math.max(nocdMinTick, tickTime-(ts/nocdStepFactor))
                //     }
                // }else{
                //     tickTime /= step;
                // }

                // instead of speeding up we'll do it only if alt pressed
                const altFactor = globals.toolManager.altDown ? 0.2 : 1;
                tickTime = Math.max(tickTime / step, tickMin * altFactor);

                if (player.placed.length > player.maxPlaced) {
                    player.placed = player.placed.slice(-player.maxPlaced);
                }
                if (!player.placed.length) return;
                if (!player.bucket.spend(1)) return;

                const [x, y, c] = player.placed.pop();

                placePixel(x, y, c, false);
            }
            while (--multiTicks)
        }.bind(this);

        this.on('down', down);
        globals.eventManager.on('mousemove', move);
        this.on('up', up);
    }
}
const ctrlZ = new CtrlZ('ctrlZ', 'KeyZ', revertIcon);

class Grid extends Tool {
    constructor(...args) {
        super(...args);

        this.state = 0;
        this.fx = null;

        this.isLight = JSON.parse(getOrDefault('lightGrid', false));
        this.pattern = null;

        camera.on('zoom', () => {
            if (this.state == 1) {
                this.tryRender();
            }
        });

        this.on('down', this.pressed.bind(this));
        if (JSON.parse(getOrDefault('enableGrid', false))) {
            this.show();
        }
    }

    pressed(e) {
        if (e.repeat) return;
        this.toggle();
    }

    /**@param {CanvasRenderingContext2D} ctx*/
    drawGrid(ctx) {
        let [x, y] = screenToBoardSpace(0, 0),
            [clientX, clientY] = boardToScreenSpace(x, y);

        let { width, height } = ctx.canvas;
        const zoom = camera.zoom;

        // ctx.fillStyle = this.isLight ? 'white' : 'black';
        ctx.fillStyle = 'rgb(127,127,127)'
        ctx.globalAlpha = 0.8;

        let thickInterval;
        if (chunkSize % 16 == 0) thickInterval = 16;
        else if (chunkSize % 10 == 0) thickInterval = 10;
        else thickInterval = null;

        // finally, i decided to disable this feature
        thickInterval = null;

        let wid = 1;

        // kostyl
        x--; y--;

        // pixels lines
        for (; clientX < width; clientX += zoom) {
            x++
            if (x % thickInterval == 0) wid = .7;
            else wid = .7;

            if (x % chunkSize == 0) wid = 1;

            ctx.fillRect(clientX, 0, wid, height);
        }

        for (; clientY < height; clientY += zoom) {
            y++
            if (y % thickInterval == 0) wid = .7;
            else wid = .7;

            if (y % chunkSize == 0) wid = 1;

            ctx.fillRect(0, clientY, width, wid);
        }

        ctx.globalAlpha = 1;
    }

    tryRender() {
        if (!this.fx || this.fx.removed) {
            this.fx = new FX(this.render.bind(this));
            addFX(this.fx, 2);
        }
    }

    toggle() {
        if (this.state == 0) this.show();
        else this.hide();
        setLS('enableGrid', (!!this.state).toString())
    }

    show() {
        this.state = 1;
        this.tryRender();
    }

    hide() {
        this.state = 0;
        this.fx && removeFX(this.fx);
    }

    render(ctx) {
        if (camera.zoom <= 4) return 1;

        this.drawGrid(ctx);
    }
}
const grid = new Grid('grid', 'KeyG');

// WARNING: it's not supposed to be a bot
// so it won't check for connection or re-check image
// write your own bots please 
class Paste extends Tool {
    constructor(...args) {
        super(...args);

        // 0 - idle
        // 1 - choosing
        // 2 - placing
        // 3 - drawing
        this.state = 0;

        this.moveFX = null;
        this.drawInterval = null;

        this.initListeners();
    }

    initListeners() {
        this.on('down', this.down.bind(this));
    }

    async down() {
        if (this.state == 0 || this.state == 1) {
            this.state = 1;

            try {
                const canvas = await this.getImage();
                this.startPlace(canvas);
            } catch {
                this.state = 0;
            }
        } else if (this.state == 2) {
            // this.state = 0
            // this.stopPlace();
        } else if (this.state == 3) {
            this.state = 0;
            this.stopDraw();
        }
    }

    async getImage() {
        // get file from system
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png';

        input.click();

        return new Promise((res, rej) => {
            input.onchange = () => {
                input.onchange = null;

                if (!input.files.length || input.files[0] == "") {
                    return rej();
                }

                // read first file with filereader
                const reader = new FileReader();
                reader.readAsDataURL(input.files[0]);

                reader.onload = () => {
                    // load image with "img" tag
                    const img = new Image();
                    img.src = reader.result;
                    img.onload = () => {
                        // draw image on canvas to get its data
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        res(canvas);
                    }
                    img.onerror = rej;
                }
                reader.onerror = rej;
            }
        })
    }

    startPlace(canvas) {
        player.resetColors();
        this.state = 2;

        let xPos = player.x,
            yPos = player.y;

        function render(ctx) {
            const [x, y] = boardToScreenSpace(xPos, yPos);
            const z = camera.zoom;
            ctx.globalAlpha = 0.5;

            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            ctx.oImageSmoothingEnabled = false;

            ctx.save();
            ctx.scale(z, z);
            ctx.drawImage(canvas, x / z, y / z);
            ctx.restore();

            ctx.globalAlpha = 1;
            return 1
        }

        const fx = this.moveFX = new FX(render);
        addFX(fx);

        function move() {
            let newX = player.x,
                newY = player.y;
            if (newX == xPos && newY == yPos)
                return;

            xPos = newX;
            yPos = newY;
        }

        let lastX, lastY;
        let down = function (e) {
            lastX = e.clientX;
            lastY = e.clientY;
        }

        let up = function (e) {
            if (e.button == 2) {
                this.state = 0;
                this.stopPlace(); off();
                return;
            };

            let [x, y] = [e.clientX, e.clientY];
            if (Math.abs(x - lastX) > 5 || Math.abs(y - lastY) > 5) return;

            off();

            this.stopPlace();
            this.startDraw(canvas, xPos, yPos);
        }
        up = up.bind(this);

        function off() {
            globals.eventManager.off('mousedown', down);
            globals.eventManager.off('mouseup', up);
            globals.toolManager.off('move', move);
        }

        globals.eventManager.on('mousedown', down);
        globals.eventManager.on('mouseup', up);
        globals.toolManager.on('move', move);
    }

    stopPlace() {
        removeFX(this.moveFX);
        this.removeAllListeners('move');
    }

    startDraw(canvas, offx, offy) {
        this.state = 3;

        const ctx = canvas.getContext('2d');
        const { width: w } = canvas;

        let imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let offset = -4;

        function draw() {
            let allowance = Math.floor(player.bucket.allowance);
            if (allowance == 0) return;

            let pixels = [];

            while (allowance > 0 && offset < imgdata.length - 4 && pixels.length < 16000) {
                offset += 4;

                let rgba = [
                    imgdata[offset],
                    imgdata[offset + 1],
                    imgdata[offset + 2],
                    imgdata[offset + 3],
                ]

                if (rgba[3] < 127) continue;

                let off = offset / 4;
                const x = off % w,
                    y = off / w | 0;

                const boardX = offx + x,
                    boardY = offy + y;
                if (boardX < 0 || boardX >= boardWidth ||
                    boardY < 0 || boardY >= boardHeight)
                    continue

                const color = closestColor(rgba, palette);
                const oldCol = globals.chunkManager.getChunkPixel(boardX, boardY);
                if (oldCol == color) continue;

                allowance--;

                pixels.push([boardX, boardY, color]);
            }

            if (pixels.length) {
                player.bucket.spend(pixels.length);
                globals.socket.sendPixels(pixels);
            }

            if (offset >= imgdata.length - 4) {
                this.state = 0;
                this.stopDraw();
            }
        }

        this.drawInterval = setInterval(draw.bind(this), 50);
    }

    stopDraw() {
        clearInterval(this.drawInterval);
    }
}
const paste = new Paste('paste', 'CTRL+KeyV', null, ROLE.MOD);

// TODO move it to config or globals
let tempOpacity = parseFloat(getOrDefault('template.opacity', 0.5, true));
const templateOp1 = new Tool('template 0/N opaq', 'KeyO');
templateOp1.on('down', () => {
    if (template.opacity == 0) {
        template.opacity = tempOpacity;
    } else {
        tempOpacity = template.opacity
        template.opacity = 0;
    }
    updateTemplate();
});

const templateOp2 = new Tool('template 1/N opaq', 'KeyP');
templateOp2.on('down', () => {
    if (template.opacity == 1) {
        template.opacity = tempOpacity;
    } else {
        tempOpacity = template.opacity
        template.opacity = 1;
    }
    updateTemplate();
});

class Square extends Tool {
    constructor(...args) {
        super(...args);

        this.handlers();
    }

    handlers() {
        let startCoords, endCoords, lastCoords = [],
            fx, isDown = false,
            square,
            color, color2;

        function down() {
            if (isDown) return;
            isDown = true;

            startCoords = [player.x, player.y];

            [color, color2] = [player.color, player.secondCol];

            this.emit('move');
        }

        function move() {
            if (!isDown || !startCoords) return;

            endCoords = [player.x, player.y];

            if (endCoords[0] != lastCoords[0] || endCoords[1] != lastCoords[1]) {
                lastCoords = endCoords;

                const pixels = shapes.square(...startCoords, ...endCoords)

                fx && removeFX(fx);
                fx = new FX((ctx) => {
                    ctx.globalAlpha = .5;

                    for (let [x, y] of pixels) {
                        const [sx, sy] = boardToScreenSpace(x, y);
                        const color = getColByCord(x, y);
                        ctx.fillStyle = hexPalette[color];
                        ctx.fillRect(sx, sy, camera.zoom, camera.zoom);
                    }

                    ctx.globalAlpha = 1;

                    return 1
                })
                addFX(fx)
            }
        }

        function up() {
            this.off('tick', tick);
            isDown = false;

            if (!startCoords) return;

            fx && fx.remove();

            if (!endCoords) endCoords = [player.x, player.y];

            square = shapes.square(...startCoords, ...endCoords);

            renderFX();

            if (square.length <= 1) return;
            this.on('tick', tick);
        }

        function tick() {
            let infCd = (player.bucket.allowance === Infinity);

            if(!this.lastTick) this.lastTick = Date.now();

            if(infCd && Date.now()-this.lastTick < 50) return;
            this.lastTick = Date.now();

            // ограничитель для 0кд
            let counter = 0;
            let toSend = [];
            while (counter < 1000) {
                if (!square || !square.length) {
                    this.off('tick', tick);
                    break;
                }

                const [x, y] = square.pop();
                const col = getColByCord(x, y, color, color2);

                if (col === undefined || col === -1) return this.off('tick', tick);
                if (!checkBounds(x, y)) continue;
                if (getPixel(x, y) === col) continue;
                if (!player.bucket.spend(1)) return square.push([x, y]);

                counter++;

                if(infCd){
                    toSend.push([x,y,col]);
                }else{
                    placePixel(x, y, col);
                }
            }

            if(toSend.length){
                placePixels(toSend, true);
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
const square = new Square('square', 'KeyJ');

const incBrush = new Tool('+brush size', 'BracketRight'); // [
incBrush.on('down', () => {
    if (player.brushSize >= 100) return;
    if (player.brushSize == 1) return updateBrush(4);
    updateBrush(player.brushSize + 2);
});

const decBrush = new Tool('-brush size', 'BracketLeft'); // ]
decBrush.on('down', () => {
    if (player.brushSize <= 4) return updateBrush(1);
    updateBrush(player.brushSize - 2);
})

class Copy extends Tool {
    constructor(...args) {
        super(...args);

        // 0 - idle
        // 1 - started selection
        this.state = 0;

        this.selectFX = null;

        this.initListeners();
    }

    initListeners() {
        this.on('down', this.down.bind(this));
    }

    down(e) {
        if (this.state > 0 || paste.state > 0)
            return

        // since default key is ctrl+c
        const isTextSelected = (window.getSelection().type === 'Range');
        if (isTextSelected) return;

        e.preventDefault();
        e.stopPropagation();

        camera.disableMove();
        player.resetColors();
        globals.elements.mainCanvas.style.cursor = 'crosshair';

        this.state = 1;

        let fx;
        let startX, startY, endX, endY;

        let altPressed = false,
            lassoMode = false,
            lassoPoints = [];
        function keydown(e) {
            if (e.key === 'Alt')
                altPressed = true;
        }
        // function keyup(e) {
        //     // tf is this ... ???
        //     if (e.key === 'Alt')
        //         altPressed = false;
        // }

        function mousedown() {
            console.log({ altPressed })
            if (altPressed) {
                lassoMode = true;
                lassoPoints = [[player.x, player.y]];
            } else {
                startX = player.x;
                startY = player.y;
            }
        }
        function mousemove() {
            if (lassoMode) {
                let x = player.x,
                    y = player.y;

                lassoPoints.push([x, y]);
            } else {
                endX = player.x + 1;
                endY = player.y + 1;
            }
        }
        function mouseup() {
            // area is selected and we can tell Paste tool to draw it
            globals.elements.mainCanvas.style.cursor = '';

            removeFX(fx);

            globals.eventManager.off('keydown', keydown);
            // globals.eventManager.off('keyup', keyup);
            globals.eventManager.off('mousedown', mousedown);
            globals.eventManager.off('mousemove', mousemove);
            globals.eventManager.off('mouseup', mouseup);

            this.state = 0;

            camera.enableMove();

            onSelected();
        }

        function render(ctx) {
            ctx.save();

            ctx.strokeStyle = 'gray';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.globalAlpha = 1;

            if (lassoMode) {
                ctx.beginPath();
                const firstCord = boardToScreenSpace(lassoPoints[0][0], lassoPoints[0][1]);
                ctx.moveTo(...firstCord);
                for (let i = 1; i < lassoPoints.length; i++) {
                    const point = lassoPoints[i];
                    ctx.lineTo(...boardToScreenSpace(...point))
                }
                ctx.closePath();
                ctx.stroke();
            } else {
                const [x1, y1] = boardToScreenSpace(startX, startY);
                const [x2, y2] = boardToScreenSpace(endX, endY);
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            }

            ctx.restore();
            return 1
        }
        fx = new FX(render);
        addFX(fx);

        keydown = keydown.bind(this);
        // keyup = keyup.bind(this);
        mousedown = mousedown.bind(this);
        mousemove = mousemove.bind(this);
        mouseup = mouseup.bind(this);

        globals.eventManager.on('keydown', keydown);
        // globals.eventManager.on('keyup', keyup);
        globals.eventManager.on('mousedown', mousedown);
        globals.eventManager.on('mousemove', mousemove);
        globals.eventManager.on('mouseup', mouseup);


        function onSelected() {
            let minX, maxX, minY, maxY;
            if (lassoMode) {
                minX = maxX = lassoPoints[0][0];
                minY = maxY = lassoPoints[0][1];
                for (let i = 0; i < lassoPoints.length; i++) {
                    const point = lassoPoints[i];
                    if (point[0] < minX)
                        minX = point[0];
                    if (point[0] > maxX)
                        maxX = point[0];
                    if (point[1] < minY)
                        minY = point[1];
                    if (point[1] > maxY)
                        maxY = point[1];
                }
            } else {
                if ([startX, startY, endX, endY].some(x => x === undefined))
                    return;

                minX = Math.min(startX, endX);
                maxX = Math.max(startX, endX) + 1;
                minY = Math.min(startY, endY);
                maxY = Math.max(startY, endY) + 1;
            }

            // normalize coordinates
            minX = Math.max(minX, 0);
            maxX = Math.min(maxX, boardWidth);
            minY = Math.max(minY, 0);
            maxY = Math.min(maxY, boardHeight);

            const w = maxX - minX;
            const h = maxY - minY;

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            const data = ctx.createImageData(w, h);

            // poly x coordinates and y coordinates arrays
            let vertx, verty;
            if (lassoMode) {
                vertx = new Array(lassoPoints.length);
                verty = new Array(lassoPoints.length);

                for (let i = 0; i < lassoPoints.length; i++) {
                    const point = lassoPoints[i];
                    vertx[i] = point[0];
                    verty[i] = point[1];
                }
            }

            // local canvas coordinates
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    const i = (x + y * w) * 4;

                    // absolute board coordinates
                    const cx = minX + x;
                    const cy = minY + y;

                    if (lassoMode && !testPointInPolygon(lassoPoints.length, vertx, verty, cx, cy)) {
                        continue
                    }

                    const colId = globals.chunkManager.getChunkPixel(cx, cy);
                    const col = palette[colId];

                    data.data[i] = col[0];
                    data.data[i + 1] = col[1];
                    data.data[i + 2] = col[2];
                    data.data[i + 3] = 255;
                }
            }

            ctx.putImageData(data, 0, 0);

            // let the Paste tool do other stuff
            paste.startPlace(canvas);
        }
    }
}
const copy = new Copy('copy', 'CTRL+KeyC', null, ROLE.MOD);

const pixelInfo = new Tool('pixel info', 'KeyI');

let last = null, pinfoFx = null
function removeLast(){
    if(last){
        last.remove();
        last = null;
    }
    if(pinfoFx){
        pinfoFx.remove();
        pinfoFx = null;
    }
}
globals.eventManager.on('mouseup', removeLast);

pixelInfo.on('up', async () => {
    removeLast()

    const [x, y] = [player.x, player.y];

    const resp = await apiRequest(`/pixelInfo?canvas=${canvasId}&x=${x}&y=${y}`);
    const data = await resp.json();
    if(!data || !data.type) return;

    const el = $('<div class="infoBubble"><span style="user-select:text"></span></div>');
    last = el;

    const coordsLegend = $('<div>');
    coordsLegend[0].style.cssText = 
    `position: absolute;
    top: -7px;
    left: 0;
    width: 100%;
    font-size: 14px;
    font-weight: bold;
    text-shadow: rgb(255 255 255) -1px 1px 0px, rgb(255 255 255) 1px 1px 0px, rgb(255 255 255) 1px -1px 0px, rgb(255 255 255) -1px -1px 0px;
    text-align: center;`
    coordsLegend.text(`(${x}, ${y})`)

    el.append(coordsLegend);

    let text = '';

    if(data.type === 'UID'){
        const sanitizedName = htmlspecialchars(data.placer.nick);

        text += '<b>UID</b>&nbsp;' + data.placer.id + '<br>',
        text += '<b>name</b>&nbsp;' + sanitizedName;
    }else{
        text += `<b>${data.type}</b>`;
        if(data.placer){
            text += '&nbsp;' + data.placer
        }
    }
    
    $('span', el).html(text);

    $('body').append(el);

    const w = el[0].clientWidth;
    const h = el[0].clientHeight;

    function fixPos(){
        const [clientX, clientY] = boardToScreenSpace(x, y);
        const posX = clientX+(camera.zoom/2)-(w/2)
        const posY = clientY-h-11;

        el.css('top', posY).css('left', posX);

        return 1;
    }
    fixPos();


    pinfoFx = new FX(() => {
        fixPos();
    })
    addFX(pinfoFx, 2);
});

export default {
    clicker,
    mover,
    floodfill,
    pipette, altPipette,
    line,
    colorInc, colorDec,
    colorSwap,
    chatOpac, menuOpac, allOpac,
    ctrlZ,
    protector, altProtector,
    grid,
    copy,
    paste,
    cordAdd,
    templateOp1, templateOp2,
    square,
    incBrush, decBrush,
    pixelInfo
}
