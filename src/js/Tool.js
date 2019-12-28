import EventEmitter from 'events'

export default class Tool extends EventEmitter{
    constructor(name, iconURL, defaultKey=null){
        super();

        this.name = name;
        this.icon = iconURL;

        this.key = defaultKey
    }
}