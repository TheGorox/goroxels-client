import EventEmitter from 'events'
import globals from './globals'
import tools from './tools'
import camera from './camera'
import player from './player'
import {
    insanelyLongMobileBrowserCheck,
    screenToBoardSpace,
    eventToString
} from './utils'
import {
    maxZoom
} from './config'

const coords = document.getElementById('coords');

function updatePlayerCoords(clientX, clientY) {
    let [newX, newY] = screenToBoardSpace(clientX, clientY);

    if (newX === player.x && newY === player.y) {
        return
    }

    player.x = newX;
    player.y = newY;

    coords.innerText = `(${player.x}, ${player.y})`

    if (player.color != -1)
        globals.renderer.needRender = true;
}

const isMobile = insanelyLongMobileBrowserCheck();

export default class ToolManager extends EventEmitter {
    constructor() {
        super();

        this.tools = tools;
        this.tool = tools.mover;

        this._keyBinds = {};
        this.activeTools = {};

        this.addTools();
        this.initEvents();
    }

    addTools() {
        const toolsEl = document.getElementById('tools');

        Object.keys(this.tools).forEach(name => {
            const tool = this.tools[name];

            if (isMobile) {
                if(!tool.icon) return;
                
                let el = document.createElement('div');
                el.classList = 'toolContainer';
                let img = document.createElement('img');
                img.className = 'toolIcon';
                img.src = tool.icon;

                el.appendChild(img);
                toolsEl.appendChild(el); // todo add click choosing etc

                el.addEventListener('pointerdown', choose.bind(this));

                function choose() {
                    let oldTool = document.getElementsByClassName('toolContainer selected')[0]
                    if (oldTool)
                        oldTool.className = 'toolContainer';

                    el.classList = ['toolContainer selected'];
                    this.tool = tool;
                }
                if (tool.name === 'mover')
                    choose.apply(this);
            } else {
                this._keyBinds[tool.key] = tool;
            }
        })

        if (!isMobile) document.getElementById('tools').style.display = 'none';
    }

    initEvents() {
        let em = globals.eventManager;

        if (isMobile) {
            em.on('zoom', zoom => {
                camera.zoom *= zoom + 1;
                camera.checkZoom();
                globals.renderer.needRender = true;
            });

            em.on('mousedown', e => {
                updatePlayerCoords(e.clientX, e.clientY);
            });

            em.on('mousemove', e => {
                updatePlayerCoords(e.clientX, e.clientY);
            });

            let events = [
                ['mousedown', 'down'],
                ['mousemove', 'move'],
                ['mouseup', 'up'],
                ['tick', 'tick']
            ];

            events.forEach(event => {
                em.on(event[0], e => {
                    let tool = this.tool;
                    if (e && e.gesture) {
                        tool = this.tools.mover;
                    }
                    if (!tool) return

                    tool.emit(event[1], e);
                });
            });
        } else {
            em.on('mousemove', e => {
                if (e.buttons != 0) {
                    camera.moveTo(-e.movementX / camera.zoom / devicePixelRatio, -e.movementY / camera.zoom / devicePixelRatio);
                } else {
                    updatePlayerCoords(e.clientX, e.clientY);
                }

                this.tool.emit('move', e)
            });

            em.on('keydown', e => {
                let str = eventToString(e);
                if (!str) return;

                const tool = this._keyBinds[str];

                if (tool) {
                    this.tool = tool; // костыль, переделать
                    tool.emit('down');
                }
            });

            em.on('keyup', e => {
                let str = eventToString(e);
                if (!str) return;

                const tool = this._keyBinds[str];

                if (tool) {
                    tool.emit('up');
                }
            });

            em.on('wheel', e => {
                const oldZoom = camera.zoom;
                camera.zoomTo(e.deltaY);

                const dx = e.clientX - window.innerWidth / 2;
                const dy = e.clientY - window.innerHeight / 2;

                camera.moveTo((dx / oldZoom), (dy / oldZoom));
                camera.moveTo(-(dx / camera.zoom), -(dy / camera.zoom));

                renderer.needRender = true;
            });

            em.on('tick', e => {
                this.tool.emit('tick', e);
            });
        }
    }

    changeKey(toolName, key) {
        const tool = this.tools[toolName];
        if (!tool) return console.error('Tool not found wtf');

        const oldKey = tool.key;
        delete this._keyBinds[oldKey];

        this._keyBinds[key] = toolName
    }
}