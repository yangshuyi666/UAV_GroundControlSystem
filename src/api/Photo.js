import axios from './request'

// 获取相册拍摄记录（GET + query 参数）
export const getPhotos = ({ user_id, limit = 10 }) =>
    axios.get('/v1/images/camera/logs', {
        params: { user_id, limit }
    })

// 按 ID 删除图片（DELETE）
export const deletePhotoById = (image_id) =>
    axios.delete(`/v1/images/camera/image/${image_id}`)

// 导出原图（GET - 二进制）
export const exportPhotoById = (image_id) =>
    axios.get(`/v1/images/camera/export/${image_id}`, {
        responseType: 'blob'
    })

// 修改图片描述（PUT）
export const updatePhotoDesc = (image_id, desc) =>
    axios.put(`/v1/images/camera/image/${image_id}/desc`, { desc })

//分析图片
export const analyzePhoto = (image_id) =>
    axios.get(`/v1/images/camera/analyze/${image_id}`)