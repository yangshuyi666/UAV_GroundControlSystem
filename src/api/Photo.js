import axios from './request'

export const getPhotos = () => axios.get('/photos')

export const deletePhotoById = (id) => axios.delete(`/photos/${id}`)
