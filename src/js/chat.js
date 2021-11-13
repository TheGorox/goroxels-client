import { canvasName, game } from './config';
import globals from './globals';
import { translate as t_ } from './translate';
import cssColors from './utils/cssColorsList'
import { getLS, getOrDefault, setLS } from './utils/localStorage';
import { htmlspecialchars } from './utils/misc';

// currently chat supports only one channel
// but socket is designed to handle many

function pad(pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

class Chat {
    constructor() {
        this.element = $('#chat');
        this.logElem = $('#chatLog');

        this.colorsEnabled = !JSON.parse(getOrDefault('disableColors', false));

        this.muted = JSON.parse(getLS('muted')) || [];
    }

    // mobile version of hide/show
    mobileShow(){
        this.element.css('top', '0');
    }

    mobileHide(){
        this.element.css('top', '-100vh');
    }

    setColors(state) {
        this.colorsEnabled = state;

        $('.chatColored').toggleClass('noColor', !state);
    }

    parseColors(str) {
        // colors should be formatted like: [RED]test or [#FF0000]te[]st

        let colorEntries = 0;

        let regIter = str.matchAll(/\[(#?[A-Z0-9]+)*?\]/gi);
        while (true) {
            let {
                value: entry,
                done
            } = regIter.next();
            if (done) break;

            let color = entry[1];

            if (color) {
                if (color.startsWith('#')) {
                    color = pad(color.slice(-1).repeat(6 + 1), color);
                } else if (!cssColors[color]) continue;

                str = str.replace(entry[0],
                    `<div class="chatColored${this.colorsEnabled ? '' : ' noColor'}" style="color:${color}">`);
                colorEntries++;
            } else { // empty braces
                if (colorEntries > 0) {
                    str = str.replace(entry[0], '</div>');
                    colorEntries--;
                } else {
                    // "[" and "]"
                    str = str.replace(entry[0], '&#91;&#93;');
                }
            }
        }

        if (colorEntries > 0) str += '</div>'.repeat(colorEntries);

        return str
    }

    parseCoords(text){
        return text.replace(/\((\d{1,5}), ?(\d{1,5})\)/g,
        `<a class="cordgo" onclick="camera.centerOn($1, $2)">$&</a>`)
    }

    // TODO?
    // probably, no
    //parseBB(){}

    addMessage(message) {
        if (message.server)
            return this.addServerMessage(message.msg);

        let text = htmlspecialchars(message.msg),
            nick = htmlspecialchars(message.nick);

        const realNick = nick;

        text = this.parseColors(text);
        text = this.parseCoords(text);

        nick = this.parseColors(nick);

        const isMuted = ~this.muted.indexOf(realNick);

        const msgEl = $(
            `<div class="chatMessage" ${isMuted ? 'style="display:none"' : ''}>
            <div class="messageNick" data-nick="${realNick}">${nick}:</div>
            <div class="messageText">${text}</div>
        </div>`)

        this.logElem.append(msgEl);

        this.afterAddingMessage();
    }

    addLocalMessage(text) {
        text = this.parseColors(text);
        text = this.parseCoords(text);

        const msgEl = $(
            `<div class="chatMessage">
                <div class="messageText">${text}</div>
            </div>`)

        this.logElem.append(msgEl);

        this.afterAddingMessage();
    }

    addServerMessage(text) {
        this.addLocalMessage(text)
    }

    afterAddingMessage(){
        if(this.logElem.children().length > game.chatLimit){
            this.logElem.children()[0].remove();
        }
        this.logElem[0].scrollBy(0, 999);
    }

    // handles messages to send
    handleMessage(message) {
        if (message.startsWith('/')) {
            this.handleCommand(message);
        } else
            globals.socket.sendChatMessage(message, canvasName);
    }

    // handles chat commands
    handleCommand(command) {
        let args = command.split(' ').slice(1);

        // currently works shitty
        if (command.startsWith('/mute')) {
            const nick = args.join(' ');
            this.mute(nick);
        }else if(command.startsWith('/unmute')){
            const nick = args.join(' ');
            this.unmute(nick);
        }
    }

    mute(nick) {
        const pref = '<b>mute:</b> ';

        if (!nick.length || nick.length > 32) {
            return this.addLocalMessage(pref + t_('Wrong nick length'))
        }
        if(~this.muted.indexOf(nick)){
            return this.addLocalMessage(pref + t_('Player is already muted'))
        }

        this.muted.push(nick);
        setLS('muted', JSON.stringify(this.muted));

        $('.messageNick').each((_, el) => {
            if(el.dataset.nick === nick){
                el.parentElement.style.display = 'none';
            }
        })
    }

    unmute(nick){
        let pref = '<b>unmute:</b> ', index;

        if (!nick.length || nick.length > 32) {
            return this.addLocalMessage(pref + t_('Wrong nick length'))
        }
        if(!~(index=this.muted.indexOf(nick))){
            return this.addLocalMessage(pref + t_('Player is not muted'))
        }

        this.muted.splice(index, 1);
        setLS('muted', JSON.stringify(this.muted));

        $('.messageNick').each((_, el) => {
            if(el.dataset.nick === nick){
                el.parentElement.style.display = 'block';
            }
        })
    }
}

export default globals.chat = new Chat();