import EventEmitter from 'events'
import { ROLE } from './constants';

export default class Tool extends EventEmitter{
    constructor(name, defaultKey=null, iconURL=null, minRole=ROLE.GUEST){
        super();

        this.name = name;
        this.icon = iconURL;

        this.key = defaultKey ? defaultKey.toString() : undefined;

        this.requiredRole = minRole;
    }
}