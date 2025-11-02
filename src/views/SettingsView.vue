<template>
    <div class="settings-view-container">
        <button @click="logout">退出登录</button>
    </div>
</template>


<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const logout = () => {
    localStorage.removeItem("token")
    router.push("/login")
}


</script>


<style scoped></style>