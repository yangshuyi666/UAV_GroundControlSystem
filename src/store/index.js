import { createStore } from 'vuex'

const store = createStore({
    state: {
        mapStyle: 'normal',
        isPlanning: false,
        controlModel: 'Automatic',
    },
    mutations: {
        setMapStyle(state, style) {
            state.mapStyle = style
        },
        setIsPlanning(state, val) {
            state.isPlanning = val;
        },
    },
    getters: {

    },
    actions: {

    },
    modules: {

    }
})

export default store