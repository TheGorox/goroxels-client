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

        this.updateRoleRelatedHtml();
    },

    updateRoleRelatedHtml(){
        $('.minrole-admin').hide();
        $('.minrole-mod').hide();
        $('.minrole-trusted').hide();
        $('.minrole-user').hide();

        switch(this.role){
            case ROLE.ADMIN:
                $('.minrole-admin').show();
            case ROLE.MOD:
                $('.minrole-mod').show();
            case ROLE.TRUSTED:
                $('.minrole-trusted').show();
            case ROLE.USER:
                $('.minrole-user').show();
        }
    },

    checkCanGetUserInfo(){
        return this.registered && this.role >= ROLE.TRUSTED
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