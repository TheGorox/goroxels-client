import EventEmitter from 'events'
import globals from './globals'
import tools from './tools'
import {
    insanelyLongMobileBrowserCheck
} from './utils'

const isMobile = insanelyLongMobileBrowserCheck();

export default class ToolManager extends EventEmitter {
    constructor() {
        super();

        this.tools = tools; // yes
        this.tool = tools[0];

        this._keyBinds = {};

        this.addTools();
        this.initEvents();
    }

    addTools() {
        const toolsEl = document.getElementById('tools');

        if (isMobile) {
            this.tools.forEach(tool => {
                let el = document.createElement('div');
                el.className = 'toolContainer';
                let img = document.createElement('img');
                img.className = 'toolIcon';
                img.src = tool.icon;

                el.appendChild(img);
                toolsEl.appendChild(el);
            })
        }
    }

    initEvents() {
        if (isMobile) {
            let events = [
                ['mousedown', 'down'],
                ['mousemove', 'move'],
                ['mouseup', 'up'],
                ['tick', 'tick']
            ];

            events.forEach(event => {
                globals.eventManager.on(event[0], e => {
                    this.tool && this.tool.emit(event[1], e);
                });
            })
        } else {

        }
    }

    changeKey(toolName, key) {
        const tool = this.tools.find(tool => tool.name === toolName);
        if (!tool) return console.error('Tool not found wtf');

        const oldKey = tool.key;
        delete this._keyBinds[oldKey];

        this._keyBinds[key] = toolName
    }
}