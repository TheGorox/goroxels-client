import EventEmitter from 'events';
import globals from './globals';
import tools from './tools';
import camera from './camera';
import player from './player';
import {
    screenToBoardSpace
} from './utils/conversions';
import {
    insanelyLongMobileBrowserCheck,
    stringifyKeyEvent,
    decodeKey
} from './utils/misc';
import toastr from 'toastr';

const coords = document.getElementById('coords');

function updatePlayerCoords(clientX, clientY) {
    let [newX, newY] = screenToBoardSpace(clientX, clientY);

    if (newX === player.x && newY === player.y) {
        return
    }

    player.x = newX;
    player.y = newY;

    coords.innerText = `(${player.x}, ${player.y})`

    if (player.color != -1 && camera.zoom > 1)
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
                if (!tool.icon) return;

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
                const [realEvent, myEvent] = event[0];
                em.on(realEvent, e => {
                    if(event === 'tick'){
                        Object.keys(this.tools).forEach(name => {
                            const tool = this.tools[name];
                            if(tool.listenerCount(e) > 0){
                                tool.emit(myEvent, e);
                            }
                        });
                        return
                    }
                    let tool = this.tool;
                    if (e && e.gesture) {
                        tool = this.tools.mover;
                    }
                    if (!tool) return

                    tool.emit(myEvent, e);
                });
            });
        } else {
            // TODO все слушатели напрямую к eventManager
            em.on('mousedown', e => {
                this.tools.mover.emit('down', e)
            });
            em.on('mouseup', e => {
                this.tools.mover.emit('up', e)
            });
            em.on('mousemove', e => {
                if (e.buttons === 0) {
                    updatePlayerCoords(e.clientX, e.clientY);
                }

                this.tool != tools.mover && this.tools.mover.emit('move', e);
                this.tool.emit('move', e)
            });

            em.on('keydown', e => {
                let str = stringifyKeyEvent(e);
                if (!str) return;

                const tool = this._keyBinds[str];

                if (tool) {
                    e.preventDefault();
                    e.stopPropagation();

                    // todo
                    this.tool = tool; // костыль, переделать
                    tool.emit('down', e);
                }
            });

            em.on('keyup', e => {
                let str = stringifyKeyEvent(e);
                if (!str) return;

                const tool = this._keyBinds[str];

                for(let name of Object.keys(this.tools)){
                    const tool2 = this.tools[name];

                    if(!tool2.key || tool2 === tool)
                        continue;

                    const key = decodeKey(tool2.key);
                    if(key.keyCode === e.keyCode){
                        tool2.emit('up', e)
                    }
                }

                if (tool) {
                    e.preventDefault();
                    e.stopPropagation();

                    tool.emit('up', e);
                }
            });

            em.on('wheel', e => {
                const oldZoom = camera.zoom;
                camera.zoomTo(e.deltaY);

                const dx = e.clientX - window.innerWidth / 2;
                const dy = e.clientY - window.innerHeight / 2;

                camera.moveTo((dx / oldZoom), (dy / oldZoom));
                camera.moveTo(-(dx / camera.zoom), -(dy / camera.zoom));
            });

            em.on('tick', e => {
                Object.keys(this.tools).forEach(name => {
                    const tool = this.tools[name];
                    if(tool.listenerCount('tick') > 0){
                        tool.emit('tick', e);
                    }
                });
            });
        }
    }

    changeKey(tool, key) {
        const oldKey = tool.key;
        delete this._keyBinds[oldKey];

        tool.key = key;
        this._keyBinds[key] = tool
    }
}