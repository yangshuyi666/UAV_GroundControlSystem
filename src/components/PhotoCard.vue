<template>
    <el-card class="photo-card" shadow="hover">
        <el-image :src="photo.url" fit="cover" lazy class="photo-img" :preview-src-list="[photo.url]" />

        <div class="photo-info">
            <div class="time">{{ formatTime(photo.time) }}</div>
            <div class="location">📍 {{ photo.latitude.toFixed(5) }}, {{ photo.longitude.toFixed(5) }}</div>
        </div>

        <div class="actions">
            <el-button type="danger" size="small" plain @click="handleDelete">
                删除
            </el-button>
        </div>
    </el-card>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { ElMessageBox } from 'element-plus'

const props = defineProps({
    photo: {
        type: Object,
        required: true
    }
})
const emit = defineEmits(['delete'])

const handleDelete = () => {
    ElMessageBox.confirm('确定要删除这张照片吗？', '提示', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
    })
        .then(() => emit('delete', props.photo.id))
        .catch(() => { }) // 用户取消
}

const formatTime = (time) => {
    const date = new Date(time)
    return date.toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.photo-card {
    width: 280px;
    border-radius: 10px;
    overflow: hidden;
    transition: transform 0.2s ease;
}

.photo-card:hover {
    transform: translateY(-4px);
}

.photo-img {
    width: 100%;
    height: 180px;
    border-radius: 8px;
}

.photo-info {
    margin-top: 8px;
    font-size: 13px;
    color: #555;
}

.actions {
    margin-top: 6px;
    text-align: right;
}
</style>
