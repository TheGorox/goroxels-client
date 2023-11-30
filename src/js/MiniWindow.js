import EventEmitter from 'events';

export default class MiniWindow extends EventEmitter{
    // 1=ok, 2=ok+cancel
    constructor(title='', closeButtons=1){
        super();

        this.title = title;

        this._closeButtons = closeButtons;

        this.element = null;
        this.bodyElement = null;

        this.closed = false;

        this._create();
    }

    _create(){
        const html = $(`
        <div class="miniWindow">
            <div class="miniWindowTitle">
                ${this.title}
            </div>
            <div class="miniWindowBody">
            </div>
            <div class="miniWindowButtons">
            </div>
        </div>
        `);

        const buttons = [];
        if(this._closeButtons >= 1){
            const okButton = $('<button>ok</button>');
            okButton.on('click', this.buttonHandler.bind(this, 'ok'));
            buttons.push(okButton);
        }
        if(this._closeButtons >= 2){
            const cancelButton = $('<button>cancel</button>');
            cancelButton.on('click', this.buttonHandler.bind(this, 'cancel'));
            buttons.push(cancelButton);
        }
        
        buttons.forEach(b => $('.miniWindowButtons', html).append(b));

        this.element = html;
        this.bodyElement = $('.miniWindowBody', html);
    }

    buttonHandler(buttonName){
        const event = {
            _cancelledClose: false,
            cancelClose: function(){ this._cancelledClose = true }
        }

        switch(buttonName){
            case 'ok':
                this.emit('okClicked', event);
                break;
            case 'cancel':
                this.emit('cancelClicked', event);
        }

        if(!event._cancelledClose){
            this.close();
        }
    }

    close(){
        this.removeAllListeners();
        this.element.remove();
        this.closed = true;
    }
}