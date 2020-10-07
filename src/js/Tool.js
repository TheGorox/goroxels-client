import EventEmitter from 'events'

export default class Tool extends EventEmitter{
    constructor(name, defaultKey=null, iconURL=null){
        super();

        this.name = name;
        this.icon = iconURL;

        this.key = defaultKey ? defaultKey.toString() : undefined;
    }
}