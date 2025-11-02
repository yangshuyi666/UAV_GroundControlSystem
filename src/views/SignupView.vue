<template>
    <div class="signup-container">
        <el-card class="signup-card">
            <h2 class="title">注册新账号</h2>
            <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" clearable />
                </el-form-item>

                <el-form-item label="密码" prop="password">
                    <el-input v-model="form.password" placeholder="请输入密码" show-password clearable />
                </el-form-item>

                <el-form-item label="确认密码" prop="confirmPassword">
                    <el-input v-model="form.confirmPassword" placeholder="请再次输入密码" show-password clearable />
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" @click="handleSignup" :loading="loading" style="width: 100%;">
                        注册
                    </el-button>
                </el-form-item>

                <div class="footer">
                    <span>已有账号？</span>
                    <el-link type="primary" @click="$router.push('/login')">去登录</el-link>
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
    password: '',
    confirmPassword: ''
})

const rules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    confirmPassword: [
        { required: true, message: '请再次输入密码', trigger: 'blur' },
        {
            validator: (_, value, callback) => {
                if (value !== form.value.password) {
                    callback(new Error('两次输入的密码不一致'))
                } else {
                    callback()
                }
            },
            trigger: 'blur'
        }
    ]
}

const loading = ref(false)

const handleSignup = () => {
    formRef.value.validate(async valid => {
        if (!valid) return
        loading.value = true
        try {
            const res = await axios.post('/signup', {
                username: form.value.username,
                password: form.value.password
            })
            if (res.data?.success) {
                ElMessage.success('注册成功，请登录')
                router.push('/login')
            } else {
                ElMessage.error(res.data?.message || '注册失败')
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
.signup-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(180deg, #eaf6ff, #cce7ff);
}

.signup-card {
    width: 400px;
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
