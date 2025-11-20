import axios from './request'

/**
 * 获取飞行日志列表（按用户 ID）
 */
export const getFlightLogs = ({ user_id, limit = 20 }) =>
    axios.get(`/v1/logs/user/${user_id}`, {
        params: { limit }
    })

/**
 * 删除指定飞行日志
 */
export const deleteFlightLogById = (log_id) =>
    axios.delete(`/v1/logs/${log_id}`)
