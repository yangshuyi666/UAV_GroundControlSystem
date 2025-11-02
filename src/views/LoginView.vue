<template>
    <div class="login-container">
        <el-card class="login-card">
            <h2 class="title">无人机地面控制系统</h2>
            <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" clearable />
                </el-form-item>

                <el-form-item label="密码" prop="password">
                    <el-input v-model="form.password" placeholder="请输入密码" show-password clearable />
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%;">
                        登录
                    </el-button>
                </el-form-item>

                <div class="footer">
                    <span>还没有账号？</span>
                    <el-link type="primary" @click="$router.push('/signup')">立即注册</el-link>
                </div>
            </el-form>
        </el-card>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from '@/api/request.js'
import { useRouter } from 'vue-router'

const router = useRouter()

const formRef = ref(null)
const form = ref({
    username: '',
    password: ''
})

const rules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const loading = ref(false)

const handleLogin = () => {
    formRef.value.validate(async valid => {
        if (!valid) return
        loading.value = true
        try {
            const res = await axios.post('/login', form.value)
            if (res.data?.token) {
                localStorage.setItem('token', res.data.token)
                ElMessage.success('登录成功！')
                router.push('/')
            } else {
                ElMessage.error(res.data?.message || '登录失败')
            }
        } catch (err) {
            ElMessage.error(err.response?.data?.message || '请求失败，请稍后重试')
        } finally {
            loading.value = false
        }
    })
}
</script>

<style scoped>
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(180deg, #eaf6ff, #cce7ff);
}

.login-card {
    width: 380px;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 100, 255, 0.1);
}

.title {
    text-align: center;
    color: #007bff;
    margin-bottom: 20px;
    font-weight: 600;
}

.footer {
    text-align: center;
    margin-top: 10px;
}
</style>
