import axios from 'axios'

const instance = axios.create({
    baseURL: 'http://localhost:8000/api',
    timeout: 5000
})


// 响应拦截器 —— 统一处理错误、过期等
instance.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Token无效或过期
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);


export default instance