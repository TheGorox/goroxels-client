import { canvasName, game } from './config';
import { chatInput } from './elements';
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

const colorRegEx = new RegExp(/\[(#?[A-Z0-9]{1,8})*?\]/gi);
                          // https : / / host.com/img .png       ? q=321123
const imgRegEx = new RegExp(/http?s:\/\/.+?\.(png|jpg|jpeg|gif)(\?\S+)?/i);

class Chat {
    constructor() {
        this.element = $('#chat');

        this.logElems = {};

        this.colorsEnabled = !JSON.parse(getOrDefault('disableColors', false));

        this.muted = JSON.parse(getLS('muted')) || [];

        this.channel = undefined;

        this.initChatEvents();
    }

    loadChannelElements(){
        [...$('#chatLog').children()].map(el => {
            let channel = el.dataset.channel;
            if(channel === 'local'){
                channel = canvasName;
            }
            this.logElems[channel] = $(el);
        })
    }

    // mobile version of hide/show
    mobileShow() {
        this.element.css('top', '0');
    }

    mobileHide() {
        this.element.css('top', '-100vh');
    }

    setColors(state) {
        this.colorsEnabled = state;

        $('.chatColored').toggleClass('noColor', !state);
    }

    parseColors(str) {
        // colors should be formatted like: [RED]test or [#FF0000]te[]st

        let colorEntries = 0;

        let regIter = str.matchAll(colorRegEx);
        while (true) {
            let {
                value: entry,
                done
            } = regIter.next();
            if (done) break;

            let color = entry[1];

            if (color) {
                // test for "#" and mathing A-F a-f hex alphabet
                if (color.startsWith('#') && !/[G-Zg-z]/.test(color)) {
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
    parseCoords(str) {
        return str.replace(/\((\d{1,5}), ?(\d{1,5})\)/g,
            `<a class="cordgo" onclick="camera.centerOn($1, $2)">$&</a>`)
    }
    parseImage(str) {
        let matching = str.match(imgRegEx);

        if (matching) {
            let src = matching[0];
            str = str.replace(src,
                `<span class="imageLink" onclick="globals.chat.toggleImage(this)">${src}</span>`) 
        }

        return str
    }
    toggleImage(target){
        const element = $(target);
        const parent = element.parent();

        const exists = !!$('img', parent).length;
        if(exists){
            $('.imageLink', parent).css('cursor', 'zoom-in')
            $('img', parent).remove();
        }else{
            $('.imageLink', parent).css('cursor', 'zoom-out');
            const img = $(`<img src="${element.text()}" class="chatImg" onclick="globals.chat.toggleImage(this)">`);
            img.on('load', this.scroll.bind(this, this.channel));
            parent.append(img);
        }
    }

    parseBB(str){
        // function does not checks for brackets order validity
        let openedTags = [];

        let regIter = str.matchAll(/\[(\/?[bi])\]/gi);
        while (true) {
            let {
                value: entry,
                done
            } = regIter.next();
            if (done) break;

            let tag = entry[1];
            str = str.replace(entry[0],
                `<${tag}>`);
            if(!tag.startsWith('/'))
                openedTags.push(tag);
            else{
                openedTags = openedTags.splice(openedTags.indexOf(tag.slice(1)));
            }
        }

        while(openedTags.length){
            str += `</${openedTags.shift()}>`
        }

        return str
    }

    addMessage(message) {
        $('.showChat').addClass('showChat-notify');

        const channel = message.ch;

        if (message.server)
            return this.addServerMessage(message.msg, channel);

        let text = htmlspecialchars(message.msg),
            nick = htmlspecialchars(message.nick);

        const realNick = nick;

        if (nick === 'Goroh') {
            nick = `<span style="text-shadow:0 0 3px">[#00f986]${nick}</span>`
        }

        try{
            text = this.parseColors(text);
            text = this.parseBB(text);
            text = this.parseCoords(text);
            text = this.parseImage(text);
    
            nick = this.parseColors(nick);
        }catch(e){
            console.log(e);
        }

        const isMuted = ~this.muted.indexOf(realNick);

        const msgEl = $(
            `<div class="chatMessage" ${isMuted ? 'style="display:none"' : ''}>
            <div class="messageNick" data-nick="${realNick}">${nick}:</div>
            <div class="messageText">${text}</div>
        </div>`);

        $('.messageNick', msgEl).on('click', function () {
            const visibleNick = this.innerText.slice(0, -1);
            globals.elements.chatInput.value += visibleNick + ', ';
            globals.elements.chatInput.focus();
        })

        this.logElems[channel].append(msgEl);

        this.afterAddingMessage(channel);
    }

    addLocalMessage(text, channel) {
        text = this.parseColors(text);
        text = this.parseBB(text);
        text = this.parseCoords(text);
        text = this.parseImage(text);

        const msgEl = $(
            `<div class="chatMessage">
                <div class="messageText">${text}</div>
            </div>`)

        this.logElems[channel].append(msgEl);

        this.afterAddingMessage(channel);
    }

    switchChannel(channel){
        if(this.channel === channel){
            return;
        }

        const channelAlias = channel;
        if(channel === 'local'){
            channel = canvasName;
        }

        for(let ch of Object.values(this.logElems)){
            ch.hide();
        }
        this.logElems[channel].show();

        $(`#chatChannels>div`).removeClass('selected');
        $(`#chatChannels>div[data-channel="${channelAlias}"]`).addClass('selected');

        this.scroll(channel, true);

        this.channel = channel;
    }

    addServerMessage(text, channel) {
        this.addLocalMessage(text, channel);
    }

    afterAddingMessage(channel) {
        const el = this.logElems[channel];
        if (el.children().length > game.chatLimit) {
            el.children()[0].remove();
        }
        this.scroll(channel);
    }

    // handles messages to send
    handleMessage(message) {
        if (message.startsWith('/')) {
            this.handleCommand(message);
        } else
        globals.socket.sendChatMessage(message, this.channel);
    }

    sendWhisper(target, message){
        globals.socket.sendChatWhisper(message, this.channel, target);
    }

    // handles chat commands
    handleCommand(command) {
        let args = command.split(' ');

        const cmd = args[0];
        args = args.slice(1);

        console.log(args);

        switch(cmd){
            case '/mute': {
                const nick = args.join(' ');
                this.mute(nick);

                break
            }
            case '/unmute': {
                const nick = args.join(' ');
                this.unmute(nick);

                break
            }
            case '/w': {
                if(args.length < 2){
                    return this.addLocalMessage('Usage: /w &lt;targetAccountId&gt; &lt;message&gt;');
                }
                const id = args[0];
                const msg = args.slice(1).join(' ');

                this.sendWhisper(id, msg);
                chatInput.val(`/w ${id} `);

                break
            }
        }
    }

    mute(nick) {
        const pref = '<b>mute:</b> ';

        if (!nick.length || nick.length > 32) {
            return this.addLocalMessage(pref + t_('Wrong nick length'))
        }
        if (~this.muted.indexOf(nick)) {
            return this.addLocalMessage(pref + t_('Player is already muted'))
        }

        this.muted.push(nick);
        setLS('muted', JSON.stringify(this.muted));

        $('.messageNick').each((_, el) => {
            if (el.dataset.nick === nick) {
                el.parentElement.style.display = 'none';
            }
        })
    }

    unmute(nick) {
        let pref = '<b>unmute:</b> ', index;

        if (!nick.length || nick.length > 32) {
            return this.addLocalMessage(pref + t_('Wrong nick length'))
        }
        if (!~(index = this.muted.indexOf(nick))) {
            return this.addLocalMessage(pref + t_('Player is not muted'))
        }

        this.muted.splice(index, 1);
        setLS('muted', JSON.stringify(this.muted));

        $('.messageNick').each((_, el) => {
            if (el.dataset.nick === nick) {
                el.parentElement.style.display = 'block';
            }
        })
    }

    initChatEvents() {
        chatInput.on('input', () => {
            const value = chatInput.val();
            if (imgRegEx.test(value)) {
                chatInput.css('color', 'white');
            } else {
                chatInput.css('color', '');
            }
        })
    }

    // this function scrolls only if player scrolled chat log to the end
    scroll(channel='global', force=false){
        const el$ = this.logElems[channel];
        const el = el$.parent()[0];
        const lastElemHeight = el$.children().slice(-1).innerHeight() || 0;
        // 2 is message margin and 5 is just for fun
        const scrolled = (el.scrollHeight - el.scrollTop - el.clientHeight - lastElemHeight) <= 2+5;
        if(scrolled || force){
            el.scrollBy(0, 999);
        }
    }
}

export default globals.chat = new Chat();