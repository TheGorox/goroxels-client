import { apiRequest } from './actions';
import { ROLE } from './constants'

let loaded = false;
let cbs = [];

export default {
    registered: false,
    name: null,
    id: null,
    role: ROLE.GUEST,
    update(newMe){
        this.registered = newMe.registered;
        if(newMe.registered){
            this.name = newMe.name;
            this.role = newMe.role;
            this.id = newMe.id;
        }

        switch(this.role){
            case ROLE.USER:
                $('.admin').hide();
                $('.mod').hide();
                break
            case ROLE.ADMIN:
                $('.admin').show();
            case ROLE.MOD:
                $('.mod').show();
        }
    },

    async load(){
        const response = await apiRequest('/me');
        const user = await response.json();

        this.update(user);

        loaded = true;
        this.callStacked();
    },

    callOnLoaded(cb){
        if(this.loaded)
            return cb();
        cbs.push(cb);
    },
    callStacked(){
        cbs.forEach(cb => cb());
        cbs = [];
    }
}