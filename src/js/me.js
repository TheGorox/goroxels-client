export default {
    registered: false,
    name: null,
    role: 'guest',
    update(newMe){
        this.registered = newMe.registered || false;
        this.name = newMe.name || null;
        this.role = newMe.role || 'guest';
    }
}